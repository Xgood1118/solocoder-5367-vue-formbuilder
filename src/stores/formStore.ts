import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SchemaField, FormStatus, ToastPayload, PresetItem, FormSchema } from '@/types'
import { generateId, createEmptySchema, persistToStorage, loadFromStorage } from '@/utils/schemaConverter'

const STORAGE_KEY = 'vue-formbuilder-state'
const MAX_HISTORY = 50

interface FieldPosition {
  parentId?: string | null
  index?: number
}

interface HistorySnapshot {
  schema: FormSchema
  selectedFieldId: string | null
}

export const useFormStore = defineStore('form', () => {
  const schema = ref<FormSchema>(createEmptySchema())
  const selectedFieldId = ref<string | null>(null)
  const formStatus = ref<FormStatus>('idle')
  const undoStack = ref<HistorySnapshot[]>([])
  const redoStack = ref<HistorySnapshot[]>([])
  const toasts = ref<ToastPayload[]>([])
  const presets = ref<PresetItem[]>([])
  let toastIdCounter = 0

  const fields = computed(() => schema.value.fields)

  const selectedField = computed((): SchemaField | null => {
    if (!selectedFieldId.value) return null
    return findFieldById(selectedFieldId.value, schema.value.fields)
  })

  function findFieldById(id: string, list: SchemaField[]): SchemaField | null {
    for (const f of list) {
      if (f.id === id) return f
      if (f.type === 'group' && f.children?.length) {
        const found = findFieldById(id, f.children)
        if (found) return found
      }
    }
    return null
  }

  function findFieldLocation(
    id: string,
    list: SchemaField[] = schema.value.fields,
    parent: SchemaField[] = schema.value.fields,
    parentId: string | null = null
  ): { parent: SchemaField[]; index: number; field: SchemaField; parentId: string | null } | null {
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      if (f.id === id) {
        return { parent, index: i, field: f, parentId }
      }
      if (f.type === 'group' && f.children?.length) {
        const found = findFieldLocation(id, f.children, f.children, f.id)
        if (found) return found
      }
    }
    return null
  }

  function snapshot(): HistorySnapshot {
    return {
      schema: JSON.parse(JSON.stringify(schema.value)),
      selectedFieldId: selectedFieldId.value
    }
  }

  function restore(snap: HistorySnapshot) {
    schema.value = JSON.parse(JSON.stringify(snap.schema))
    selectedFieldId.value = snap.selectedFieldId
  }

  function pushUndo() {
    undoStack.value.push(snapshot())
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  function undo() {
    if (undoStack.value.length === 0) return
    const current = snapshot()
    redoStack.value.push(current)
    const prev = undoStack.value.pop()!
    restore(prev)
    persistAll()
  }

  function redo() {
    if (redoStack.value.length === 0) return
    const current = snapshot()
    undoStack.value.push(current)
    const next = redoStack.value.pop()!
    restore(next)
    persistAll()
  }

  function selectField(id: string | null) {
    selectedFieldId.value = id
  }

  function addField(field: SchemaField, position?: FieldPosition) {
    pushUndo()
    let targetParent: SchemaField[] = schema.value.fields
    if (position?.parentId) {
      const loc = findFieldLocation(position.parentId)
      if (loc && loc.field.type === 'group') {
        loc.field.children = loc.field.children || []
        targetParent = loc.field.children
      }
    }
    if (position?.index !== undefined) {
      targetParent.splice(position.index, 0, field)
    } else {
      targetParent.push(field)
    }
    schema.value.meta.updatedAt = new Date().toISOString()
    selectedFieldId.value = field.id
    persistAll()
  }

  function removeField(id: string) {
    const loc = findFieldLocation(id)
    if (!loc) return
    pushUndo()
    loc.parent.splice(loc.index, 1)
    if (selectedFieldId.value === id) {
      selectedFieldId.value = null
    }
    schema.value.meta.updatedAt = new Date().toISOString()
    persistAll()
  }

  function updateField(id: string, patch: Partial<SchemaField>) {
    const loc = findFieldLocation(id)
    if (!loc) return
    pushUndo()
    Object.assign(loc.field, patch)
    schema.value.meta.updatedAt = new Date().toISOString()
    persistAll()
  }

  function duplicateField(id: string) {
    const loc = findFieldLocation(id)
    if (!loc) return
    pushUndo()
    const cloned = JSON.parse(JSON.stringify(loc.field)) as SchemaField
    const updateIds = (f: SchemaField) => {
      f.id = generateId()
      if (f.type === 'group' && f.children) {
        f.children.forEach(updateIds)
      }
    }
    updateIds(cloned)
    loc.parent.splice(loc.index + 1, 0, cloned)
    schema.value.meta.updatedAt = new Date().toISOString()
    selectedFieldId.value = cloned.id
    persistAll()
  }

  function moveField(sourceId: string, position: FieldPosition & { afterId?: string }) {
    const srcLoc = findFieldLocation(sourceId)
    if (!srcLoc) return
    pushUndo()
    const [removed] = srcLoc.parent.splice(srcLoc.index, 1)
    let targetParent: SchemaField[] = schema.value.fields
    if (position.parentId) {
      const loc = findFieldLocation(position.parentId)
      if (loc && loc.field.type === 'group') {
        loc.field.children = loc.field.children || []
        targetParent = loc.field.children
      }
    }
    if (position.afterId) {
      const afterLoc = findFieldLocation(position.afterId, targetParent, targetParent, null)
      if (afterLoc) {
        targetParent.splice(afterLoc.index + 1, 0, removed)
      } else {
        targetParent.push(removed)
      }
    } else if (position.index !== undefined) {
      targetParent.splice(position.index, 0, removed)
    } else {
      targetParent.push(removed)
    }
    schema.value.meta.updatedAt = new Date().toISOString()
    persistAll()
  }

  function reorderField(id: string, direction: 'up' | 'down') {
    const loc = findFieldLocation(id)
    if (!loc) return
    const newIndex = direction === 'up' ? loc.index - 1 : loc.index + 1
    if (newIndex < 0 || newIndex >= loc.parent.length) return
    pushUndo()
    const [removed] = loc.parent.splice(loc.index, 1)
    loc.parent.splice(newIndex, 0, removed)
    schema.value.meta.updatedAt = new Date().toISOString()
    persistAll()
  }

  function changeStatus(status: FormStatus) {
    formStatus.value = status
  }

  function showToast(payload: Omit<ToastPayload, 'id'> & { id?: string }) {
    const id = payload.id || `toast_${++toastIdCounter}`
    const toast: ToastPayload = { id, ...payload, duration: payload.duration || 3000 }
    toasts.value.push(toast)
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => dismissToast(id), toast.duration)
    }
  }

  function dismissToast(id: string) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      toasts.value.splice(idx, 1)
    }
  }

  function resetSchema(name?: string) {
    pushUndo()
    schema.value = createEmptySchema(name)
    selectedFieldId.value = null
    persistAll()
  }

  function savePreset(name: string, data: unknown) {
    const preset: PresetItem = {
      id: generateId(),
      name,
      data: JSON.parse(JSON.stringify(data)),
      createdAt: new Date().toISOString()
    }
    presets.value.push(preset)
    persistAll()
  }

  function removePreset(id: string) {
    const idx = presets.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      presets.value.splice(idx, 1)
      persistAll()
    }
  }

  function persistAll() {
    try {
      const data = {
        schema: schema.value,
        presets: presets.value,
        savedAt: new Date().toISOString()
      }
      persistToStorage(STORAGE_KEY, data)
    } catch (e) {
      console.error('[formStore] persist failed:', e)
    }
  }

  function initFromStorage() {
    try {
      const data = loadFromStorage(STORAGE_KEY) as { schema?: FormSchema; presets?: PresetItem[] } | null
      if (data) {
        if (data.schema) {
          schema.value = { ...createEmptySchema(), ...data.schema }
        }
        if (data.presets) {
          presets.value = data.presets
        }
      }
    } catch (e) {
      console.error('[formStore] init failed:', e)
    }
  }

  return {
    schema,
    fields,
    selectedFieldId,
    selectedField,
    formStatus,
    undoStack,
    redoStack,
    toasts,
    presets,
    initFromStorage,
    resetSchema,
    selectField,
    addField,
    removeField,
    updateField,
    duplicateField,
    moveField,
    reorderField,
    undo,
    redo,
    pushUndo,
    changeStatus,
    showToast,
    dismissToast,
    savePreset,
    removePreset,
    persistAll
  }
})
