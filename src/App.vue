<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import {
  LayoutGrid, Type, Hash, AlignLeft, List, CircleDot, CheckSquare,
  ToggleLeft, Calendar, Clock, Star, Upload, FileJson, Download,
  Save, Eye, Rocket, Trash2, Copy, ArrowUp, ArrowDown, ChevronDown,
  ChevronUp, Settings, Undo2, Redo2, FileCode, EyeOff, Wand2,
  Plus, X, FormInput, GripVertical, SlidersHorizontal, GitBranch, FileText
} from 'lucide-vue-next'
import FieldRenderer from './components/FieldRenderer.vue'
import Toast, { type ToastItem, type ToastType } from './components/Toast.vue'
import Skeleton from './components/Skeleton.vue'
import PreviewModal from './components/PreviewModal.vue'
import type {
  SchemaField, FieldType, FieldOption, ValidationRule, LinkageRule, CascaderOption
} from './components/FieldRenderer.vue'

const CURRENT_VERSION = '1.2.0'

interface FieldLibraryItem {
  type: FieldType
  label: string
  icon: typeof Type
  category: 'basic' | 'advanced' | 'layout'
}

const fieldLibrary: FieldLibraryItem[] = [
  { type: 'text', label: '文本输入', icon: Type, category: 'basic' },
  { type: 'number', label: '数字输入', icon: Hash, category: 'basic' },
  { type: 'textarea', label: '多行文本', icon: AlignLeft, category: 'basic' },
  { type: 'select', label: '下拉选择', icon: List, category: 'basic' },
  { type: 'radio', label: '单选框', icon: CircleDot, category: 'basic' },
  { type: 'checkbox', label: '多选框', icon: CheckSquare, category: 'basic' },
  { type: 'slider', label: '滑块', icon: SlidersHorizontal, category: 'basic' },
  { type: 'switch', label: '开关', icon: ToggleLeft, category: 'advanced' },
  { type: 'date', label: '日期', icon: Calendar, category: 'advanced' },
  { type: 'time', label: '时间', icon: Clock, category: 'advanced' },
  { type: 'rate', label: '评分', icon: Star, category: 'advanced' },
  { type: 'upload', label: '文件上传', icon: Upload, category: 'advanced' },
  { type: 'cascader', label: '级联选择', icon: GitBranch, category: 'advanced' },
  { type: 'richtext', label: '富文本', icon: FileText, category: 'advanced' },
  { type: 'group', label: '分组', icon: LayoutGrid, category: 'layout' }
]

const basicFields = computed(() => fieldLibrary.filter(f => f.category === 'basic'))
const advancedFields = computed(() => fieldLibrary.filter(f => f.category === 'advanced'))
const layoutFields = computed(() => fieldLibrary.filter(f => f.category === 'layout'))

let idCounter = 0
const generateId = () => `field_${Date.now()}_${++idCounter}`

const generateFieldKey = (type: FieldType, existingFields: SchemaField[]) => {
  let counter = 1
  let key = ''
  const allKeys = new Set<string>()
  const collectKeys = (fields: SchemaField[]) => {
    fields.forEach(f => {
      allKeys.add(f.field)
      if (f.type === 'group' && f.children) collectKeys(f.children)
    })
  }
  collectKeys(existingFields)
  const prefixMap: Record<FieldType, string> = {
    text: 'text', number: 'num', textarea: 'textarea',
    select: 'select', radio: 'radio', checkbox: 'checkbox',
    switch: 'switch', date: 'date', time: 'time',
    rate: 'rate', upload: 'file', group: 'group',
    slider: 'slider', cascader: 'cascader', richtext: 'richtext'
  }
  const prefix = prefixMap[type] || 'field'
  do {
    key = `${prefix}_${counter}`
    counter++
  } while (allKeys.has(key))
  return key
}

const createDefaultField = (type: FieldType, existingFields: SchemaField[]): SchemaField => {
  const id = generateId()
  const field = generateFieldKey(type, existingFields)
  const base: SchemaField = {
    id, type, label: '', field, placeholder: '',
    defaultValue: undefined, rules: { required: false },
    linkages: [], hint: ''
  }
  const labelMap: Record<FieldType, string> = {
    text: '文本输入', number: '数字输入', textarea: '多行文本',
    select: '下拉选择', radio: '单选框', checkbox: '多选框',
    switch: '开关', date: '日期选择', time: '时间选择',
    rate: '评分', upload: '文件上传', group: '分组',
    slider: '滑块', cascader: '级联选择', richtext: '富文本'
  }
  base.label = labelMap[type]
  const defaultOptions: FieldOption[] = [
    { label: '选项1', value: 'option1' },
    { label: '选项2', value: 'option2' },
    { label: '选项3', value: 'option3' }
  ]
  switch (type) {
    case 'text':
      base.placeholder = '请输入文本'; base.defaultValue = ''; break
    case 'number':
      base.placeholder = '请输入数字'; base.defaultValue = 0
      base.min = undefined; base.max = undefined; base.step = 1; break
    case 'textarea':
      base.placeholder = '请输入多行文本'; base.defaultValue = ''; break
    case 'select':
      base.placeholder = '请选择'; base.options = [...defaultOptions]
      base.defaultValue = ''; break
    case 'radio':
    case 'checkbox':
      base.options = [...defaultOptions]; base.inline = false
      base.defaultValue = type === 'checkbox' ? [] : ''; break
    case 'switch':
      base.defaultValue = false; break
    case 'date':
    case 'time':
      base.defaultValue = ''; break
    case 'rate':
      base.maxRate = 5; base.defaultValue = 0; break
    case 'upload':
      base.placeholder = '点击上传文件'; base.accept = '*'
      base.multiple = false; break
    case 'slider':
      base.min = 0; base.max = 100; base.step = 1; base.defaultValue = 0
      break
    case 'cascader':
      base.placeholder = '请选择'; base.defaultValue = []
      base.cascaderOptions = [
        {
          label: '选项1', value: 'option1',
          children: [
            { label: '选项1-1', value: 'option1-1' },
            { label: '选项1-2', value: 'option1-2' }
          ]
        },
        {
          label: '选项2', value: 'option2',
          children: [
            { label: '选项2-1', value: 'option2-1' },
            { label: '选项2-2', value: 'option2-2' }
          ]
        }
      ] as CascaderOption[]
      break
    case 'richtext':
      base.placeholder = '请输入内容'; base.defaultValue = ''; break
    case 'group':
      base.children = []; base.collapsed = false; break
  }
  return base
}

interface HistorySnapshot {
  schema: SchemaField[]
  formData: Record<string, unknown>
}
const MAX_HISTORY = 50
const schema = ref<SchemaField[]>([])
const formData = ref<Record<string, unknown>>({})
const history = ref<HistorySnapshot[]>([])
const historyIndex = ref(-1)
const selectedFieldId = ref<string | null>(null)
const selectedGroupId = ref<string | null>(null)
const isLoading = ref(true)
const isPreview = ref(false)
const showPreviewModal = ref(false)
const previewModalRef = ref<InstanceType<typeof PreviewModal> | null>(null)
const fieldRendererRef = ref<InstanceType<typeof FieldRenderer> | null>(null)
const toasts = ref<ToastItem[]>([])
let toastIdCounter = 0

const dragState = reactive({
  isDragging: false,
  draggedType: null as FieldType | null,
  draggedFieldId: null as string | null,
  draggedFromGroup: null as string | null,
  dropTargetId: null as string | null,
  dropPosition: null as 'before' | 'after' | 'inside' | null
})

const showToast = (type: ToastType, message: string, duration = 3000) => {
  const id = ++toastIdCounter
  const toast: ToastItem = { id, type, message, duration, leaving: false }
  toasts.value.push(toast)
  setTimeout(() => {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      toasts.value[idx].leaving = true
      setTimeout(() => {
        const newIdx = toasts.value.findIndex(t => t.id === id)
        if (newIdx !== -1) toasts.value.splice(newIdx, 1)
      }, 300)
    }
  }, duration)
}

const removeToast = (id: number) => {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    toasts.value[idx].leaving = true
    setTimeout(() => {
      const newIdx = toasts.value.findIndex(t => t.id === id)
      if (newIdx !== -1) toasts.value.splice(newIdx, 1)
    }, 300)
  }
}

const saveHistory = () => {
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push({
    schema: JSON.parse(JSON.stringify(schema.value)),
    formData: JSON.parse(JSON.stringify(formData.value))
  })
  if (history.value.length > MAX_HISTORY) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

const undo = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const snapshot = history.value[historyIndex.value]
    schema.value = JSON.parse(JSON.stringify(snapshot.schema))
    formData.value = JSON.parse(JSON.stringify(snapshot.formData))
    showToast('info', '已撤销操作')
  } else {
    showToast('warning', '没有可撤销的操作')
  }
}

const redo = () => {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    const snapshot = history.value[historyIndex.value]
    schema.value = JSON.parse(JSON.stringify(snapshot.schema))
    formData.value = JSON.parse(JSON.stringify(snapshot.formData))
    showToast('info', '已重做操作')
  } else {
    showToast('warning', '没有可重做的操作')
  }
}

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

interface FieldLocation {
  parent: SchemaField[]
  index: number
  field: SchemaField
  groupId: string | null
}

const findFieldLocation = (
  fieldId: string, fields: SchemaField[] = schema.value,
  groupId: string | null = null
): FieldLocation | null => {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    if (f.id === fieldId) {
      return { parent: fields, index: i, field: f, groupId }
    }
    if (f.type === 'group' && f.children) {
      const found = findFieldLocation(fieldId, f.children, f.id)
      if (found) return found
    }
  }
  return null
}

const selectedField = computed((): SchemaField | null => {
  if (!selectedFieldId.value) return null
  const loc = findFieldLocation(selectedFieldId.value)
  return loc ? loc.field : null
})

const addFieldToCanvas = (type: FieldType) => {
  const newField = createDefaultField(type, schema.value)
  let targetParent: SchemaField[] = schema.value
  if (selectedGroupId.value) {
    const loc = findFieldLocation(selectedGroupId.value)
    if (loc && loc.field.type === 'group') {
      loc.field.children = loc.field.children || []
      targetParent = loc.field.children
    }
  }
  if (dragState.dropTargetId && dragState.dropPosition) {
    const targetLoc = findFieldLocation(dragState.dropTargetId)
    if (targetLoc) {
      const insertIndex = dragState.dropPosition === 'after' ? targetLoc.index + 1 : targetLoc.index
      targetLoc.parent.splice(insertIndex, 0, newField)
    } else {
      targetParent.push(newField)
    }
  } else {
    targetParent.push(newField)
  }
  if (newField.type !== 'group' && newField.defaultValue !== undefined) {
    formData.value[newField.field] = JSON.parse(JSON.stringify(newField.defaultValue))
  }
  saveHistory()
  selectedFieldId.value = newField.id
  if (newField.type === 'group') {
    selectedGroupId.value = newField.id
  }
}

const duplicateField = (fieldId: string) => {
  const loc = findFieldLocation(fieldId)
  if (!loc) return
  const cloned = JSON.parse(JSON.stringify(loc.field)) as SchemaField
  const updateIds = (f: SchemaField) => {
    f.id = generateId()
    if (f.type === 'group' && f.children) {
      f.children.forEach(updateIds)
    } else {
      f.field = generateFieldKey(f.type, schema.value)
    }
  }
  updateIds(cloned)
  loc.parent.splice(loc.index + 1, 0, cloned)
  const collectFields = (
    f: SchemaField, result: { key: string; defaultVal: unknown }[]
  ) => {
    if (f.type === 'group' && f.children) {
      f.children.forEach(c => collectFields(c, result))
    } else if (f.defaultValue !== undefined) {
      result.push({ key: f.field, defaultVal: JSON.parse(JSON.stringify(f.defaultValue)) })
    }
  }
  const newFields: { key: string; defaultVal: unknown }[] = []
  collectFields(cloned, newFields)
  newFields.forEach(nf => { formData.value[nf.key] = nf.defaultVal })
  saveHistory()
  selectedFieldId.value = cloned.id
  showToast('success', '已复制字段')
}

const moveField = (fieldId: string, direction: 'up' | 'down') => {
  const loc = findFieldLocation(fieldId)
  if (!loc) return
  const newIndex = direction === 'up' ? loc.index - 1 : loc.index + 1
  if (newIndex < 0 || newIndex >= loc.parent.length) {
    showToast('warning', direction === 'up' ? '已经是第一个了' : '已经是最后一个了')
    return
  }
  const [removed] = loc.parent.splice(loc.index, 1)
  loc.parent.splice(newIndex, 0, removed)
  saveHistory()
}

const deleteField = (fieldId: string) => {
  const loc = findFieldLocation(fieldId)
  if (!loc) {
    showToast('warning', '未找到选中字段')
    return
  }
  const collectFields = (f: SchemaField, keys: string[]) => {
    if (f.type === 'group' && f.children) {
      f.children.forEach(c => collectFields(c, keys))
    } else {
      keys.push(f.field)
    }
  }
  const keysToRemove: string[] = []
  collectFields(loc.field, keysToRemove)
  keysToRemove.forEach(k => delete formData.value[k])
  loc.parent.splice(loc.index, 1)
  if (selectedFieldId.value === fieldId) selectedFieldId.value = null
  if (selectedGroupId.value === fieldId) selectedGroupId.value = null
  saveHistory()
  showToast('success', '已删除字段')
}

const deleteSelected = () => {
  if (selectedFieldId.value) {
    deleteField(selectedFieldId.value)
  } else {
    showToast('info', '请先选择要删除的字段')
  }
}

const onFieldLibraryDragStart = (e: DragEvent, type: FieldType) => {
  dragState.isDragging = true
  dragState.draggedType = type
  dragState.draggedFieldId = null
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', type)
  }
}

const onFieldDragStart = (e: DragEvent, fieldId: string) => {
  const loc = findFieldLocation(fieldId)
  dragState.isDragging = true
  dragState.draggedFieldId = fieldId
  dragState.draggedType = null
  dragState.draggedFromGroup = loc?.groupId || null
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', fieldId)
  }
  ;(e.currentTarget as HTMLElement).classList.add('dragging')
}

const onDragEnd = (e: DragEvent) => {
  dragState.isDragging = false
  dragState.draggedType = null
  dragState.draggedFieldId = null
  dragState.draggedFromGroup = null
  dragState.dropTargetId = null
  dragState.dropPosition = null
  ;(e.currentTarget as HTMLElement)?.classList?.remove('dragging')
  document.querySelectorAll('.drag-over, .drop-indicator').forEach(el => {
    el.classList.remove('drag-over')
    if (el.classList.contains('drop-indicator')) el.remove()
  })
}

const onCanvasFieldDragOver = (e: DragEvent, fieldId: string) => {
  e.preventDefault()
  e.stopPropagation()
  if (!dragState.isDragging) return
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  dragState.dropTargetId = fieldId
  dragState.dropPosition = e.clientY < midY ? 'before' : 'after'
  document.querySelectorAll('.drop-indicator').forEach(i => i.remove())
  el.classList.add('drag-over')
}

const onCanvasFieldDrop = (e: DragEvent, _targetId: string) => {
  e.preventDefault()
  e.stopPropagation()
  if (dragState.draggedType) {
    addFieldToCanvas(dragState.draggedType)
    showToast('success', '已添加字段')
  } else if (dragState.draggedFieldId) {
    const srcLoc = findFieldLocation(dragState.draggedFieldId)
    const targetLoc = findFieldLocation(dragState.dropTargetId || '')
    if (srcLoc && targetLoc && srcLoc.field.id !== targetLoc.field.id) {
      const [removed] = srcLoc.parent.splice(srcLoc.index, 1)
      const insertIndex = dragState.dropPosition === 'after' ? targetLoc.index + 1 : targetLoc.index
      const newTargetLoc = findFieldLocation(dragState.dropTargetId || '')
      if (newTargetLoc) {
        newTargetLoc.parent.splice(insertIndex, 0, removed)
        saveHistory()
        showToast('success', '已移动字段')
      }
    }
  }
  onDragEnd(e)
}

const onCanvasDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (!dragState.isDragging) return
  dragState.dropTargetId = null
  dragState.dropPosition = null
}

const onCanvasDrop = (e: DragEvent) => {
  e.preventDefault()
  if (!dragState.isDragging) return
  if (dragState.draggedType) {
    dragState.dropTargetId = null
    dragState.dropPosition = null
    addFieldToCanvas(dragState.draggedType)
    showToast('success', '已添加字段')
  } else if (dragState.draggedFieldId) {
    const loc = findFieldLocation(dragState.draggedFieldId)
    if (loc) {
      const [removed] = loc.parent.splice(loc.index, 1)
      if (selectedGroupId.value) {
        const groupLoc = findFieldLocation(selectedGroupId.value)
        if (groupLoc && groupLoc.field.type === 'group') {
          groupLoc.field.children = groupLoc.field.children || []
          groupLoc.field.children.push(removed)
        } else {
          schema.value.push(removed)
        }
      } else {
        schema.value.push(removed)
      }
      saveHistory()
      showToast('success', '已移动字段')
    }
  }
  onDragEnd(e)
}

const updateSelectedField = <K extends keyof SchemaField>(key: K, value: SchemaField[K]) => {
  if (!selectedField.value) return
  const loc = findFieldLocation(selectedField.value.id)
  if (loc) {
    (loc.field as any)[key] = value
    saveHistory()
  }
}

const addOption = () => {
  if (!selectedField.value || !selectedField.value.options) return
  const count = selectedField.value.options.length + 1
  updateSelectedField('options', [...selectedField.value.options, {
    label: `选项${count}`, value: `option${count}`
  }])
}

const updateOption = (index: number, key: 'label' | 'value', value: string) => {
  if (!selectedField.value || !selectedField.value.options) return
  const newOptions = [...selectedField.value.options]
  newOptions[index] = { ...newOptions[index], [key]: value }
  updateSelectedField('options', newOptions)
}

const removeOption = (index: number) => {
  if (!selectedField.value || !selectedField.value.options) return
  const newOptions = selectedField.value.options.filter((_, i) => i !== index)
  updateSelectedField('options', newOptions)
}

const updateCascaderOptionByPath = (
  options: CascaderOption[], path: number[],
  updater: (opt: CascaderOption) => CascaderOption
): CascaderOption[] => {
  if (path.length === 0) return options
  const newOptions = [...options]
  if (path.length === 1) {
    newOptions[path[0]] = updater(newOptions[path[0]])
    return newOptions
  }
  const [first, ...rest] = path
  newOptions[first] = {
    ...newOptions[first],
    children: updateCascaderOptionByPath(
      newOptions[first].children || [], rest, updater
    )
  }
  return newOptions
}

const removeCascaderOptionByPath = (
  options: CascaderOption[], path: number[]
): CascaderOption[] => {
  if (path.length === 0) return options
  const newOptions = [...options]
  if (path.length === 1) {
    newOptions.splice(path[0], 1)
    return newOptions
  }
  const [first, ...rest] = path
  newOptions[first] = {
    ...newOptions[first],
    children: removeCascaderOptionByPath(
      newOptions[first].children || [], rest
    )
  }
  return newOptions
}

const addCascaderChild = (parentPath: number[]) => {
  if (!selectedField.value || !selectedField.value.cascaderOptions) return
  let newOptions = [...selectedField.value.cascaderOptions]
  const count = Date.now()
  const newOpt: CascaderOption = { label: `新选项`, value: `cascader_${count}` }
  if (parentPath.length === 0) {
    newOptions.push(newOpt)
  } else {
    newOptions = updateCascaderOptionByPath(newOptions, parentPath, (opt) => ({
      ...opt,
      children: [...(opt.children || []), newOpt]
    }))
  }
  updateSelectedField('cascaderOptions', newOptions)
}

const updateCascaderOption = (path: number[], key: 'label' | 'value', value: string) => {
  if (!selectedField.value || !selectedField.value.cascaderOptions) return
  const newOptions = updateCascaderOptionByPath(
    selectedField.value.cascaderOptions, path, (opt) => ({
      ...opt, [key]: value
    })
  )
  updateSelectedField('cascaderOptions', newOptions)
}

const removeCascaderOption = (path: number[]) => {
  if (!selectedField.value || !selectedField.value.cascaderOptions) return
  const newOptions = removeCascaderOptionByPath(
    selectedField.value.cascaderOptions, path
  )
  updateSelectedField('cascaderOptions', newOptions)
}

const updateRule = <K extends keyof ValidationRule>(key: K, value: ValidationRule[K]) => {
  if (!selectedField.value) return
  const currentRules = selectedField.value.rules || {}
  updateSelectedField('rules', { ...currentRules, [key]: value })
}

const exportJSON = () => {
  const data = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    schema: schema.value,
    formData: formData.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `form-schema-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast('success', '已导出JSON文件')
}

const fileInputRef = ref<HTMLInputElement | null>(null)
const triggerImport = () => { fileInputRef.value?.click() }

interface ImportedData {
  version?: string
  schema?: SchemaField[]
  formData?: Record<string, unknown>
  fields?: SchemaField[]
}

const migrateImportedData = (data: ImportedData): {
  schema: SchemaField[]
  formData: Record<string, unknown>
} => {
  let resultSchema: SchemaField[] = []
  let resultFormData: Record<string, unknown> = {}
  if (data.schema) {
    resultSchema = data.schema
  } else if (data.fields) {
    resultSchema = data.fields
  }
  if (data.formData) {
    resultFormData = data.formData
  }
  const version = data.version || '0.0.0'
  const migrateField = (field: SchemaField): SchemaField => {
    if (version < '1.0.0') {
      if (!field.id) field.id = generateId()
      if (!field.rules) field.rules = { required: false }
      if (!field.linkages) field.linkages = []
    }
    if (version < '1.1.0') {
      if ((field.type === 'radio' || field.type === 'checkbox') && field.inline === undefined) {
        field.inline = false
      }
      if (field.type === 'rate' && !field.maxRate) {
        field.maxRate = 5
      }
    }
    if (version < '1.2.0') {
      if (field.type === 'upload' && field.multiple === undefined) {
        field.multiple = false
      }
      if (field.type === 'group' && field.collapsed === undefined) {
        field.collapsed = false
      }
    }
    if (field.type === 'group' && field.children) {
      field.children = field.children.map(migrateField)
    }
    return field
  }
  resultSchema = resultSchema.map(migrateField)
  return { schema: resultSchema, formData: resultFormData }
}

const handleImport = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  isLoading.value = true
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const content = ev.target?.result as string
      const data = JSON.parse(content) as ImportedData
      const migrated = migrateImportedData(data)
      schema.value = migrated.schema
      formData.value = migrated.formData
      selectedFieldId.value = null
      selectedGroupId.value = null
      history.value = []
      historyIndex.value = -1
      saveHistory()
      const originalVersion = data.version || 'unknown'
      if (originalVersion !== CURRENT_VERSION) {
        showToast('info', `已导入并迁移版本: ${originalVersion} → ${CURRENT_VERSION}`)
      } else {
        showToast('success', '已成功导入JSON文件')
      }
    } catch (err) {
      console.error(err)
      showToast('error', '导入失败: JSON格式错误')
    } finally {
      isLoading.value = false
      if (input) input.value = ''
    }
  }
  reader.onerror = () => {
    isLoading.value = false
    showToast('error', '读取文件失败')
  }
  reader.readAsText(file)
}

const saveForm = () => {
  try {
    const data = {
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
      schema: schema.value,
      formData: formData.value
    }
    localStorage.setItem('vue-formbuilder-saved', JSON.stringify(data))
    showToast('success', '已保存到本地存储')
  } catch (err) {
    console.error(err)
    showToast('error', '保存失败')
  }
}

const loadSaved = () => {
  try {
    const saved = localStorage.getItem('vue-formbuilder-saved')
    if (saved) {
      const data = JSON.parse(saved) as ImportedData & { savedAt?: string }
      const migrated = migrateImportedData(data)
      schema.value = migrated.schema
      formData.value = migrated.formData
      history.value = []
      historyIndex.value = -1
      saveHistory()
      return true
    }
  } catch (err) {
    console.error('加载保存失败', err)
  }
  return false
}

const openPreview = () => {
  showPreviewModal.value = true
  selectedFieldId.value = null
  showToast('info', '已打开预览模态框')
}

const togglePreview = openPreview

const publishForm = () => {
  if (fieldRendererRef.value) {
    const valid = fieldRendererRef.value.validateAll()
    if (!valid) {
      showToast('error', '表单校验未通过，请检查红色提示字段')
      return
    }
  }
  showToast('success', `表单已发布！共 ${countFields()} 个字段`)
}

const countFields = (): number => {
  let count = 0
  const walk = (fields: SchemaField[]) => {
    fields.forEach(f => {
      if (f.type === 'group' && f.children) {
        walk(f.children)
      } else {
        count++
      }
    })
  }
  walk(schema.value)
  return count
}

const clearCanvas = () => {
  if (schema.value.length === 0) {
    showToast('info', '画布已经是空的了')
    return
  }
  if (confirm('确定要清空画布吗？此操作可通过撤销恢复。')) {
    schema.value = []
    formData.value = {}
    selectedFieldId.value = null
    selectedGroupId.value = null
    saveHistory()
    showToast('success', '已清空画布')
  }
}

const onKeyDown = (e: KeyboardEvent) => {
  const isCtrl = e.ctrlKey || e.metaKey
  if (isCtrl) {
    switch (e.key.toLowerCase()) {
      case 's': e.preventDefault(); saveForm(); break
      case 'p': e.preventDefault(); togglePreview(); break
      case 'z':
        e.preventDefault()
        if (e.shiftKey) { redo() } else { undo() }
        break
      case 'y': e.preventDefault(); redo(); break
    }
  } else {
    switch (e.key) {
      case 'Delete':
      case 'Backspace': {
        const activeEl = document.activeElement
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable
        )
        if (!isInput) { e.preventDefault(); deleteSelected() }
        break
      }
      case 'ArrowUp': {
        if (selectedFieldId.value && !e.shiftKey) {
          const activeEl = document.activeElement
          const isInput = activeEl && (
            activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'
          )
          if (!isInput) { e.preventDefault(); moveField(selectedFieldId.value, 'up') }
        }
        break
      }
      case 'ArrowDown': {
        if (selectedFieldId.value && !e.shiftKey) {
          const activeEl = document.activeElement
          const isInput = activeEl && (
            activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'
          )
          if (!isInput) { e.preventDefault(); moveField(selectedFieldId.value, 'down') }
        }
        break
      }
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  nextTick(() => {
    const loaded = loadSaved()
    if (!loaded) {
      schema.value = [
        createDefaultField('text', []),
        createDefaultField('number', [])
      ]
      schema.value[0].label = '姓名'
      schema.value[0].field = 'name'
      schema.value[0].placeholder = '请输入您的姓名'
      schema.value[0].rules = { required: true }
      formData.value['name'] = ''
      schema.value[1].label = '年龄'
      schema.value[1].field = 'age'
      schema.value[1].placeholder = '请输入年龄'
      schema.value[1].min = 0
      schema.value[1].max = 150
      formData.value['age'] = 0
    }
    history.value = []
    historyIndex.value = -1
    saveHistory()
    setTimeout(() => { isLoading.value = false }, 500)
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

watch(schema, () => {
  const collectDefault = (fields: SchemaField[]) => {
    fields.forEach(f => {
      if (f.type === 'group' && f.children) {
        collectDefault(f.children)
      } else if (f.defaultValue !== undefined && !(f.field in formData.value)) {
        formData.value[f.field] = JSON.parse(JSON.stringify(f.defaultValue))
      }
    })
  }
  collectDefault(schema.value)
}, { deep: true })

const schemaStats = computed(() => {
  return {
    total: countFields(),
    groups: schema.value.filter(f => f.type === 'group').length
  }
})

const linkageOperatorOptions = [
  { label: '等于', value: '==' },
  { label: '不等于', value: '!=' },
  { label: '大于', value: '>' },
  { label: '小于', value: '<' },
  { label: '大于等于', value: '>=' },
  { label: '小于等于', value: '<=' },
  { label: '包含', value: 'contains' },
  { label: '属于', value: 'in' },
  { label: '为空', value: 'empty' },
  { label: '不为空', value: 'notEmpty' }
]

const linkageActionOptions = [
  { label: '显示字段', value: 'show' },
  { label: '隐藏字段', value: 'hide' },
  { label: '启用字段', value: 'enable' },
  { label: '禁用字段', value: 'disable' },
  { label: '设为必填', value: 'setRequired' },
  { label: '设为选填', value: 'setOptional' }
]

const getAllFieldKeys = computed(() => {
  const keys: { label: string; value: string }[] = []
  const walk = (fields: SchemaField[]) => {
    fields.forEach(f => {
      if (f.type === 'group' && f.children) {
        walk(f.children)
      } else {
        keys.push({ label: `${f.label} (${f.field})`, value: f.field })
      }
    })
  }
  walk(schema.value)
  return keys
})

const addLinkage = () => {
  if (!selectedField.value) return
  const firstField = getAllFieldKeys.value[0]
  const newLinkage: LinkageRule = {
    logic: 'AND', action: 'show',
    conditions: [{
      field: firstField?.value || '', operator: '==', value: ''
    }]
  }
  const current = selectedField.value.linkages || []
  updateSelectedField('linkages', [...current, newLinkage])
}

const removeLinkage = (index: number) => {
  if (!selectedField.value) return
  const current = selectedField.value.linkages || []
  updateSelectedField('linkages', current.filter((_, i) => i !== index))
}

const updateLinkage = <K extends keyof LinkageRule>(
  index: number, key: K, value: LinkageRule[K]
) => {
  if (!selectedField.value) return
  const current = [...(selectedField.value.linkages || [])]
  current[index] = { ...current[index], [key]: value }
  updateSelectedField('linkages', current)
}

const addLinkageCondition = (linkageIndex: number) => {
  if (!selectedField.value) return
  const current = [...(selectedField.value.linkages || [])]
  const firstField = getAllFieldKeys.value[0]
  current[linkageIndex].conditions.push({
    field: firstField?.value || '', operator: '==', value: ''
  })
  updateSelectedField('linkages', current)
}

const removeLinkageCondition = (linkageIndex: number, condIndex: number) => {
  if (!selectedField.value) return
  const current = [...(selectedField.value.linkages || [])]
  current[linkageIndex].conditions = current[linkageIndex].conditions.filter((_, i) => i !== condIndex)
  updateSelectedField('linkages', current)
}

const updateLinkageCondition = (
  linkageIndex: number, condIndex: number,
  key: keyof LinkageRule['conditions'][0], value: unknown
) => {
  if (!selectedField.value) return
  const current = [...(selectedField.value.linkages || [])]
  current[linkageIndex].conditions[condIndex] = {
    ...current[linkageIndex].conditions[condIndex],
    [key]: value
  }
  updateSelectedField('linkages', current)
}
</script>

<template>
  <div class="app-container" :class="{ 'preview-mode': isPreview }">
    <header class="app-header">
      <div class="app-header-left">
        <FormInput :size="24" style="color: var(--primary-color);" />
        <span class="app-header-title">Vue FormBuilder</span>
        <span class="kbd">v{{ CURRENT_VERSION }}</span>
      </div>
      <div class="app-header-right">
        <button class="btn btn-outline btn-sm" title="导入JSON" @click="triggerImport">
          <FileJson :size="16" />导入JSON
        </button>
        <input
          ref="fileInputRef" type="file"
          accept=".json,application/json"
          style="display: none" @change="handleImport"
        />
        <button class="btn btn-outline btn-sm" title="导出JSON" @click="exportJSON">
          <Download :size="16" />导出JSON
        </button>
        <div class="divider" style="margin: 0 8px; width: 1px; height: 20px; background: var(--border-color);"></div>
        <button class="btn btn-outline btn-sm" title="撤销 (Ctrl+Z)" :disabled="!canUndo" @click="undo">
          <Undo2 :size="16" />
        </button>
        <button class="btn btn-outline btn-sm" title="重做 (Ctrl+Y)" :disabled="!canRedo" @click="redo">
          <Redo2 :size="16" />
        </button>
      </div>
    </header>

    <main class="app-main">
      <aside class="panel-left" v-show="!isPreview">
        <div class="panel-header">
          <Wand2 :size="18" style="color: var(--primary-color);" />字段库
        </div>
        <div class="panel-body">
          <div class="field-category">
            <div class="field-category-title">基础组件</div>
            <div class="field-library-grid">
              <div
                v-for="item in basicFields" :key="item.type"
                class="field-card" draggable="true"
                @dragstart="(e) => onFieldLibraryDragStart(e, item.type)"
                @dragend="onDragEnd"
                @click="addFieldToCanvas(item.type)"
              >
                <component :is="item.icon" class="field-card-icon" />
                <span class="field-card-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
          <div class="field-category">
            <div class="field-category-title">高级组件</div>
            <div class="field-library-grid">
              <div
                v-for="item in advancedFields" :key="item.type"
                class="field-card" draggable="true"
                @dragstart="(e) => onFieldLibraryDragStart(e, item.type)"
                @dragend="onDragEnd"
                @click="addFieldToCanvas(item.type)"
              >
                <component :is="item.icon" class="field-card-icon" />
                <span class="field-card-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
          <div class="field-category">
            <div class="field-category-title">布局组件</div>
            <div class="field-library-grid">
              <div
                v-for="item in layoutFields" :key="item.type"
                class="field-card" draggable="true"
                @dragstart="(e) => onFieldLibraryDragStart(e, item.type)"
                @dragend="onDragEnd"
                @click="addFieldToCanvas(item.type)"
              >
                <component :is="item.icon" class="field-card-icon" />
                <span class="field-card-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section class="panel-center" @dragover="onCanvasDragOver" @drop="onCanvasDrop">
        <div class="canvas-container">
          <Skeleton v-if="isLoading" :lines="5" :show-inputs="3" :show-boxes="1" />
          <div v-else-if="schema.length === 0" class="canvas-empty">
            <LayoutGrid :size="48" />
            <p style="font-size: 16px; font-weight: 500;">画布为空</p>
            <p style="font-size: 13px;">从左侧字段库拖拽或点击组件添加到这里</p>
          </div>
          <template v-else>
            <template v-for="field in schema" :key="field.id">
              <div
                v-if="field.type === 'group'"
                :class="[
                  'canvas-field',
                  {
                    selected: selectedFieldId === field.id,
                    dragging: dragState.draggedFieldId === field.id
                  }
                ]"
                draggable="true"
                @click.stop="!isPreview && (selectedFieldId = field.id); selectedGroupId = field.id"
                @dragstart="(e) => !isPreview && onFieldDragStart(e, field.id)"
                @dragend="onDragEnd"
                @dragover="(e) => !isPreview && onCanvasFieldDragOver(e, field.id)"
                @drop="(e) => !isPreview && onCanvasFieldDrop(e, field.id)"
              >
                <div v-if="!isPreview" class="canvas-field-actions">
                  <button class="field-action-btn" title="复制" @click.stop="duplicateField(field.id)">
                    <Copy :size="14" />
                  </button>
                  <button class="field-action-btn" title="上移" @click.stop="moveField(field.id, 'up')">
                    <ArrowUp :size="14" />
                  </button>
                  <button class="field-action-btn" title="下移" @click.stop="moveField(field.id, 'down')">
                    <ArrowDown :size="14" />
                  </button>
                  <button class="field-action-btn danger" title="删除" @click.stop="deleteField(field.id)">
                    <Trash2 :size="14" />
                  </button>
                </div>
                <div v-if="!isPreview" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <GripVertical :size="16" style="color: var(--text-muted);" />
                  <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">分组</span>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <div class="form-group-header" @click.stop="selectedFieldId = field.id">
                    <div class="form-group-title">
                      <LayoutGrid :size="18" style="color: var(--primary-color);" />
                      {{ field.label }}
                    </div>
                    <ChevronDown v-if="field.collapsed" :size="18" style="color: var(--text-muted);" />
                    <ChevronUp v-else :size="18" style="color: var(--text-muted);" />
                  </div>
                  <div :class="['form-group-body', { collapsed: field.collapsed }]">
                    <div v-if="!field.children || field.children.length === 0"
                      style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;"
                    >
                      将字段拖入此分组
                    </div>
                    <template v-for="child in field.children" :key="child.id">
                      <div
                        v-if="child.type !== 'group'"
                        :class="[
                          'canvas-field',
                          {
                            selected: selectedFieldId === child.id,
                            dragging: dragState.draggedFieldId === child.id
                          }
                        ]"
                        draggable="true"
                        @click.stop="!isPreview && (selectedFieldId = child.id)"
                        @dragstart="(e) => !isPreview && onFieldDragStart(e, child.id)"
                        @dragend="onDragEnd"
                        @dragover="(e) => !isPreview && onCanvasFieldDragOver(e, child.id)"
                        @drop="(e) => !isPreview && onCanvasFieldDrop(e, child.id)"
                      >
                        <div v-if="!isPreview" class="canvas-field-actions">
                          <button class="field-action-btn" title="复制" @click.stop="duplicateField(child.id)">
                            <Copy :size="14" />
                          </button>
                          <button class="field-action-btn" title="上移" @click.stop="moveField(child.id, 'up')">
                            <ArrowUp :size="14" />
                          </button>
                          <button class="field-action-btn" title="下移" @click.stop="moveField(child.id, 'down')">
                            <ArrowDown :size="14" />
                          </button>
                          <button class="field-action-btn danger" title="删除" @click.stop="deleteField(child.id)">
                            <Trash2 :size="14" />
                          </button>
                        </div>
                        <div v-if="!isPreview" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                          <GripVertical :size="16" style="color: var(--text-muted);" />
                          <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">
                            {{ child.label }}
                            <span style="color: var(--text-muted); font-weight: 400;">({{ child.field }})</span>
                          </span>
                        </div>
                        <FieldRenderer
                          ref="fieldRendererRef"
                          :schema="[child]" v-model="formData"
                          :readonly="isPreview" :preview="isPreview"
                        />
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <div
                v-else
                :class="[
                  'canvas-field',
                  {
                    selected: selectedFieldId === field.id,
                    dragging: dragState.draggedFieldId === field.id
                  }
                ]"
                draggable="true"
                @click.stop="!isPreview && (selectedFieldId = field.id); selectedGroupId = null"
                @dragstart="(e) => !isPreview && onFieldDragStart(e, field.id)"
                @dragend="onDragEnd"
                @dragover="(e) => !isPreview && onCanvasFieldDragOver(e, field.id)"
                @drop="(e) => !isPreview && onCanvasFieldDrop(e, field.id)"
              >
                <div v-if="!isPreview" class="canvas-field-actions">
                  <button class="field-action-btn" title="复制" @click.stop="duplicateField(field.id)">
                    <Copy :size="14" />
                  </button>
                  <button class="field-action-btn" title="上移" @click.stop="moveField(field.id, 'up')">
                    <ArrowUp :size="14" />
                  </button>
                  <button class="field-action-btn" title="下移" @click.stop="moveField(field.id, 'down')">
                    <ArrowDown :size="14" />
                  </button>
                  <button class="field-action-btn danger" title="删除" @click.stop="deleteField(field.id)">
                    <Trash2 :size="14" />
                  </button>
                </div>
                <div v-if="!isPreview" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <GripVertical :size="16" style="color: var(--text-muted);" />
                  <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">
                    {{ field.label }}
                    <span style="color: var(--text-muted); font-weight: 400;">({{ field.field }})</span>
                  </span>
                </div>
                <FieldRenderer
                  ref="fieldRendererRef"
                  :schema="[field]" v-model="formData"
                  :readonly="isPreview" :preview="isPreview"
                />
              </div>
            </template>
          </template>
        </div>
      </section>

      <aside class="panel-right" v-show="!isPreview">
        <div class="panel-header">
          <Settings :size="18" style="color: var(--primary-color);" />属性配置
        </div>
        <div class="panel-body">
          <div v-if="!selectedField" style="padding: 40px 16px; text-align: center; color: var(--text-muted);">
            <EyeOff :size="40" style="margin-bottom: 12px; opacity: 0.5;" />
            <p style="font-size: 14px;">请选择一个字段</p>
            <p style="font-size: 12px; margin-top: 4px;">在画布中点击任意字段进行配置</p>
          </div>

          <template v-else>
            <div class="prop-section">
              <div class="prop-section-title">基本属性</div>
              <div class="prop-item">
                <div class="prop-label">字段标签</div>
                <input
                  class="prop-input" type="text" :value="selectedField.label"
                  @input="(e) => updateSelectedField('label', (e.target as HTMLInputElement).value)"
                />
              </div>
              <div class="prop-item">
                <div class="prop-label">字段Key</div>
                <input
                  class="prop-input" type="text" :value="selectedField.field"
                  @input="(e) => updateSelectedField('field', (e.target as HTMLInputElement).value)"
                />
              </div>
              <div class="prop-item"
                v-if="selectedField.type !== 'group' && selectedField.type !== 'switch' && selectedField.type !== 'rate'"
              >
                <div class="prop-label">占位提示</div>
                <input
                  class="prop-input" type="text" :value="selectedField.placeholder || ''"
                  @input="(e) => updateSelectedField('placeholder', (e.target as HTMLInputElement).value)"
                />
              </div>
              <div class="prop-item" v-if="selectedField.type !== 'group'">
                <div class="prop-label">帮助文本</div>
                <input
                  class="prop-input" type="text" :value="selectedField.hint || ''"
                  @input="(e) => updateSelectedField('hint', (e.target as HTMLInputElement).value)"
                />
              </div>
              <div class="prop-item" v-if="selectedField.type === 'group'">
                <div class="prop-switch-row">
                  <span class="prop-switch-label">默认折叠</span>
                  <div
                    :class="['form-field-switch', { active: selectedField.collapsed }]"
                    @click="updateSelectedField('collapsed', !selectedField.collapsed)"
                  >
                    <div class="form-field-switch-thumb" />
                  </div>
                </div>
              </div>
              <div class="prop-item" v-if="selectedField.type === 'number' || selectedField.type === 'slider'">
                <div class="prop-label">最小值</div>
                <input
                  class="prop-input" type="number" :value="selectedField.min ?? ''"
                  @input="(e) => updateSelectedField('min',
                    (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value)
                  )"
                />
              </div>
              <div class="prop-item" v-if="selectedField.type === 'number' || selectedField.type === 'slider'">
                <div class="prop-label">最大值</div>
                <input
                  class="prop-input" type="number" :value="selectedField.max ?? ''"
                  @input="(e) => updateSelectedField('max',
                    (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value)
                  )"
                />
              </div>
              <div class="prop-item" v-if="selectedField.type === 'number' || selectedField.type === 'slider'">
                <div class="prop-label">步长</div>
                <input
                  class="prop-input" type="number" :value="selectedField.step ?? 1"
                  @input="(e) => updateSelectedField('step', Number((e.target as HTMLInputElement).value) || 1)"
                />
              </div>
              <div class="prop-item" v-if="selectedField.type === 'rate'">
                <div class="prop-label">最大星数</div>
                <input
                  class="prop-input" type="number" min="1" max="10"
                  :value="selectedField.maxRate ?? 5"
                  @input="(e) => updateSelectedField('maxRate', Number((e.target as HTMLInputElement).value) || 5)"
                />
              </div>
              <div class="prop-item" v-if="selectedField.type === 'upload'">
                <div class="prop-label">接受的文件类型</div>
                <input
                  class="prop-input" type="text" :value="selectedField.accept ?? '*'"
                  placeholder="如: image/*,.pdf"
                  @input="(e) => updateSelectedField('accept', (e.target as HTMLInputElement).value)"
                />
              </div>
              <div class="prop-item" v-if="selectedField.type === 'upload'">
                <div class="prop-switch-row">
                  <span class="prop-switch-label">允许多文件</span>
                  <div
                    :class="['form-field-switch', { active: selectedField.multiple }]"
                    @click="updateSelectedField('multiple', !selectedField.multiple)"
                  >
                    <div class="form-field-switch-thumb" />
                  </div>
                </div>
              </div>
              <div class="prop-item" v-if="selectedField.type === 'radio' || selectedField.type === 'checkbox'">
                <div class="prop-switch-row">
                  <span class="prop-switch-label">横向排列</span>
                  <div
                    :class="['form-field-switch', { active: selectedField.inline }]"
                    @click="updateSelectedField('inline', !selectedField.inline)"
                  >
                    <div class="form-field-switch-thumb" />
                  </div>
                </div>
              </div>
            </div>

            <div class="prop-section" v-if="selectedField.options !== undefined">
              <div class="prop-section-title">选项配置</div>
              <div class="option-editor">
                <div
                  v-for="(opt, idx) in selectedField.options" :key="idx"
                  class="option-editor-item"
                >
                  <input
                    type="text" placeholder="标签" :value="opt.label"
                    @input="(e) => updateOption(idx, 'label', (e.target as HTMLInputElement).value)"
                  />
                  <input
                    type="text" placeholder="值" :value="String(opt.value)"
                    @input="(e) => updateOption(idx, 'value', (e.target as HTMLInputElement).value)"
                  />
                  <button
                    v-if="selectedField.options!.length > 1"
                    class="option-remove-btn" @click="removeOption(idx)"
                  >
                    <X :size="14" />
                  </button>
                </div>
                <button class="option-add-btn" @click="addOption">
                  <Plus :size="14" />添加选项
                </button>
              </div>
            </div>

            <div class="prop-section" v-if="selectedField.type === 'cascader'">
              <div class="prop-section-title" style="display: flex; align-items: center; justify-content: space-between;">
                <span>级联选项配置</span>
                <button
                  class="option-add-btn" style="padding: 2px 8px; font-size: 11px;"
                  @click="addCascaderChild([])"
                >
                  <Plus :size="12" />添加一级
                </button>
              </div>
              <div class="cascader-editor">
                <template v-for="(opt, idx) in selectedField.cascaderOptions" :key="'root-' + idx">
                  <div class="cascader-editor-item" style="padding-left: 0;">
                    <div class="cascader-editor-row">
                      <input
                        type="text" placeholder="标签" :value="opt.label"
                        @input="(e) => updateCascaderOption([idx], 'label', (e.target as HTMLInputElement).value)"
                      />
                      <input
                        type="text" placeholder="值" :value="String(opt.value)"
                        @input="(e) => updateCascaderOption([idx], 'value', (e.target as HTMLInputElement).value)"
                      />
                      <button
                        class="option-add-btn" style="padding: 2px 6px; font-size: 10px;"
                        title="添加子级" @click="addCascaderChild([idx])"
                      >
                        <Plus :size="10" />
                      </button>
                      <button
                        v-if="selectedField.cascaderOptions!.length > 1"
                        class="option-remove-btn"
                        title="删除" @click="removeCascaderOption([idx])"
                      >
                        <X :size="12" />
                      </button>
                    </div>
                    <template v-if="opt.children && opt.children.length > 0">
                      <template v-for="(child2, idx2) in opt.children" :key="'l2-' + idx + '-' + idx2">
                        <div class="cascader-editor-item" style="padding-left: 20px;">
                          <div class="cascader-editor-row">
                            <input
                              type="text" placeholder="标签" :value="child2.label"
                              @input="(e) => updateCascaderOption([idx, idx2], 'label', (e.target as HTMLInputElement).value)"
                            />
                            <input
                              type="text" placeholder="值" :value="String(child2.value)"
                              @input="(e) => updateCascaderOption([idx, idx2], 'value', (e.target as HTMLInputElement).value)"
                            />
                            <button
                              class="option-add-btn" style="padding: 2px 6px; font-size: 10px;"
                              title="添加子级" @click="addCascaderChild([idx, idx2])"
                            >
                              <Plus :size="10" />
                            </button>
                            <button
                              v-if="opt.children!.length > 1"
                              class="option-remove-btn"
                              title="删除" @click="removeCascaderOption([idx, idx2])"
                            >
                              <X :size="12" />
                            </button>
                          </div>
                          <template v-if="child2.children && child2.children.length > 0">
                            <template v-for="(child3, idx3) in child2.children" :key="'l3-' + idx + '-' + idx2 + '-' + idx3">
                              <div class="cascader-editor-item" style="padding-left: 40px;">
                                <div class="cascader-editor-row">
                                  <input
                                    type="text" placeholder="标签" :value="child3.label"
                                    @input="(e) => updateCascaderOption([idx, idx2, idx3], 'label', (e.target as HTMLInputElement).value)"
                                  />
                                  <input
                                    type="text" placeholder="值" :value="String(child3.value)"
                                    @input="(e) => updateCascaderOption([idx, idx2, idx3], 'value', (e.target as HTMLInputElement).value)"
                                  />
                                  <button
                                    v-if="child2.children!.length > 1"
                                    class="option-remove-btn"
                                    title="删除" @click="removeCascaderOption([idx, idx2, idx3])"
                                  >
                                    <X :size="12" />
                                  </button>
                                </div>
                              </div>
                            </template>
                          </template>
                        </div>
                      </template>
                    </template>
                  </div>
                </template>
              </div>
            </div>

            <div class="prop-section" v-if="selectedField.type !== 'group'">
              <div class="prop-section-title">校验规则</div>
              <div class="rule-editor">
                <div class="rule-item">
                  <span class="rule-item-label">必填</span>
                  <div
                    :class="['form-field-switch', { active: selectedField.rules?.required }]"
                    @click="updateRule('required', !selectedField.rules?.required)"
                  >
                    <div class="form-field-switch-thumb" />
                  </div>
                </div>
                <template v-if="selectedField.type === 'text' || selectedField.type === 'textarea'">
                  <div class="rule-item">
                    <span class="rule-item-label">最小长度</span>
                    <input
                      class="prop-input" style="width: 80px;" type="number" min="0"
                      :value="selectedField.rules?.minLength ?? ''"
                      @input="(e) => updateRule('minLength',
                        (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value)
                      )"
                    />
                  </div>
                  <div class="rule-item">
                    <span class="rule-item-label">最大长度</span>
                    <input
                      class="prop-input" style="width: 80px;" type="number" min="0"
                      :value="selectedField.rules?.maxLength ?? ''"
                      @input="(e) => updateRule('maxLength',
                        (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value)
                      )"
                    />
                  </div>
                  <div class="rule-item">
                    <span class="rule-item-label">格式类型</span>
                    <select
                      class="prop-select" style="width: 120px;"
                      :value="selectedField.rules?.type || ''"
                      @change="(e) => updateRule('type',
                        ((e.target as HTMLSelectElement).value as ValidationRule['type']) || undefined
                      )"
                    >
                      <option value="">无</option>
                      <option value="email">邮箱</option>
                      <option value="phone">手机号</option>
                      <option value="url">URL</option>
                      <option value="idcard">身份证</option>
                    </select>
                  </div>
                  <div class="rule-item">
                    <span class="rule-item-label">自定义正则</span>
                    <input
                      class="prop-input" style="width: 140px;" type="text"
                      placeholder="如: ^[A-Z]+$"
                      :value="selectedField.rules?.pattern || ''"
                      @input="(e) => updateRule('pattern',
                        (e.target as HTMLInputElement).value || undefined
                      )"
                    />
                  </div>
                </template>
                <template v-if="selectedField.type === 'number'">
                  <div class="rule-item">
                    <span class="rule-item-label">数值最小值</span>
                    <input
                      class="prop-input" style="width: 80px;" type="number"
                      :value="selectedField.rules?.min ?? ''"
                      @input="(e) => updateRule('min',
                        (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value)
                      )"
                    />
                  </div>
                  <div class="rule-item">
                    <span class="rule-item-label">数值最大值</span>
                    <input
                      class="prop-input" style="width: 80px;" type="number"
                      :value="selectedField.rules?.max ?? ''"
                      @input="(e) => updateRule('max',
                        (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value)
                      )"
                    />
                  </div>
                </template>
                <div class="rule-item">
                  <span class="rule-item-label">错误提示</span>
                  <input
                    class="prop-input" style="width: 140px;" type="text"
                    placeholder="自定义错误消息"
                    :value="selectedField.rules?.message || ''"
                    @input="(e) => updateRule('message',
                      (e.target as HTMLInputElement).value || undefined
                    )"
                  />
                </div>
              </div>
            </div>

            <div class="prop-section" v-if="selectedField.type !== 'group'">
              <div class="prop-section-title" style="display: flex; align-items: center; justify-content: space-between;">
                <span>联动规则</span>
                <button
                  v-if="getAllFieldKeys.length > 1"
                  class="option-add-btn" style="padding: 2px 8px; font-size: 11px;"
                  @click="addLinkage"
                >
                  <Plus :size="12" />添加
                </button>
              </div>
              <div v-if="getAllFieldKeys.length <= 1"
                style="font-size: 12px; color: var(--text-muted); padding: 8px 4px;"
              >
                需要至少2个字段才能设置联动
              </div>
              <div v-else-if="!selectedField.linkages || selectedField.linkages.length === 0"
                style="font-size: 12px; color: var(--text-muted); padding: 8px 4px;"
              >
                暂无联动规则
              </div>
              <div v-else style="display: flex; flex-direction: column; gap: 12px;">
                <div
                  v-for="(linkage, lIdx) in selectedField.linkages" :key="lIdx"
                  style="padding: 10px; background: var(--bg-secondary); border-radius: var(--radius-sm);"
                >
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <select
                      class="prop-select" style="width: 100px;"
                      :value="linkage.action"
                      @change="(e) => updateLinkage(lIdx, 'action',
                        (e.target as HTMLSelectElement).value as LinkageRule['action']
                      )"
                    >
                      <option v-for="opt in linkageActionOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                    <button class="option-remove-btn" @click="removeLinkage(lIdx)">
                      <X :size="14" />
                    </button>
                  </div>
                  <div style="margin-bottom: 6px;">
                    <select
                      class="prop-select" style="width: 80px; display: inline-block;"
                      :value="linkage.logic"
                      @change="(e) => updateLinkage(lIdx, 'logic',
                        (e.target as HTMLSelectElement).value as LinkageRule['logic']
                      )"
                      v-show="linkage.conditions.length > 1"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div
                      v-for="(_cond, cIdx) in linkage.conditions" :key="cIdx"
                      style="display: flex; gap: 4px; align-items: center;"
                    >
                      <select
                        class="prop-select" style="flex: 1; min-width: 0;"
                        :value="linkage.conditions[cIdx].field"
                        @change="(e) => updateLinkageCondition(lIdx, cIdx, 'field',
                          (e.target as HTMLSelectElement).value
                        )"
                      >
                        <option
                          v-for="fk in getAllFieldKeys.filter(x => x.value !== selectedField!.field)"
                          :key="fk.value" :value="fk.value"
                        >
                          {{ fk.label }}
                        </option>
                      </select>
                      <select
                        class="prop-select" style="width: 70px;"
                        :value="linkage.conditions[cIdx].operator"
                        @change="(e) => updateLinkageCondition(lIdx, cIdx, 'operator',
                          (e.target as HTMLSelectElement).value as any
                        )"
                      >
                        <option v-for="op in linkageOperatorOptions" :key="op.value" :value="op.value">
                          {{ op.label }}
                        </option>
                      </select>
                      <input
                        v-if="linkage.conditions[cIdx].operator !== 'empty' && linkage.conditions[cIdx].operator !== 'notEmpty'"
                        class="prop-input" style="width: 60px;" type="text"
                        :value="String(linkage.conditions[cIdx].value ?? '')"
                        placeholder="值"
                        @input="(e) => updateLinkageCondition(lIdx, cIdx, 'value',
                          (e.target as HTMLInputElement).value
                        )"
                      />
                      <button
                        v-if="linkage.conditions.length > 1"
                        class="option-remove-btn"
                        @click="removeLinkageCondition(lIdx, cIdx)"
                      >
                        <X :size="12" />
                      </button>
                    </div>
                  </div>
                  <button
                    v-if="getAllFieldKeys.length > 2"
                    class="option-add-btn" style="margin-top: 6px; padding: 4px; font-size: 11px;"
                    @click="addLinkageCondition(lIdx)"
                  >
                    <Plus :size="12" />添加条件
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </aside>
    </main>

    <footer class="app-footer">
      <div class="app-footer-left">
        <FileCode :size="14" />
        <span>字段: {{ schemaStats.total }} 个 | 分组: {{ schemaStats.groups }} 个</span>
        <span style="margin: 0 8px;">|</span>
        <span>
          <span class="kbd">Ctrl+S</span> 保存
          <span style="margin: 0 4px;">·</span>
          <span class="kbd">Ctrl+P</span> 预览
          <span style="margin: 0 4px;">·</span>
          <span class="kbd">Ctrl+Z</span> 撤销
          <span style="margin: 0 4px;">·</span>
          <span class="kbd">Ctrl+Y</span> 重做
          <span style="margin: 0 4px;">·</span>
          <span class="kbd">↑↓</span> 移动
          <span style="margin: 0 4px;">·</span>
          <span class="kbd">Delete</span> 删除
        </span>
      </div>
      <div class="app-footer-right">
        <button class="btn btn-outline" @click="clearCanvas">
          <Trash2 :size="16" />清空
        </button>
        <button class="btn btn-warning" @click="togglePreview">
          <Eye :size="16" />
          预览
        </button>
        <button class="btn btn-success" @click="publishForm">
          <Rocket :size="16" />
          发布
        </button>
        <button class="btn btn-primary" @click="saveForm">
          <Save :size="16" />
          保存
        </button>
      </div>
    </footer>
  </div>

  <PreviewModal
    v-if="showPreviewModal"
    ref="previewModalRef"
    :schema="schema"
    :initial-form-data="formData"
    @close="showPreviewModal = false"
    @toast="showToast($event.type, $event.message, $event.duration)"
  />

  <Toast :toasts="toasts" @remove="removeToast" />
</template>