import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useFormStore } from '@/stores/formStore'
import {
  generateId,
  formSchemaToJSONSchema,
  jsonSchemaToFormSchema,
  migrateSchema,
  downloadJSONSchema,
  CURRENT_VERSION,
  defaultCascaderOptions
} from '@/utils/schemaConverter'
import {
  validateField,
  validateAllFields,
  evaluateLinkageRules,
  evaluateCondition
} from '@/utils/validation'
import type { SchemaField, FieldType, FormStatus, LinkageRule, FieldConfig } from '@/types'

export function useFormSchema() {
  const store = useFormStore()

  const schema = computed(() => store.schema)
  const fields = computed(() => store.schema.fields)
  const selectedFieldId = computed(() => store.selectedFieldId)
  const selectedField = computed(() => store.selectedField)
  const formStatus = computed(() => store.formStatus)
  const canUndo = computed(() => store.undoStack.length > 0)
  const canRedo = computed(() => store.redoStack.length > 0)
  const presets = computed(() => store.presets)

  const flatFields = computed(() => {
    const result: SchemaField[] = []
    function walk(list: SchemaField[]) {
      for (const f of list) {
        result.push(f)
        if (f.type === 'group' && f.children?.length) walk(f.children)
      }
    }
    walk(store.schema.fields)
    return result
  })

  const fieldNames = computed(() => flatFields.value.map(f => f.name))

  function createDefaultField(type: FieldType): SchemaField {
    const id = generateId()
    const prefixMap: Record<FieldType, string> = {
      input: 'text',
      number: 'num',
      textarea: 'desc',
      select: 'sel',
      radio: 'opt',
      checkbox: 'chk',
      slider: 'sld',
      switch: 'sw',
      date: 'dt',
      time: 'tm',
      rating: 'rate',
      upload: 'file',
      cascader: 'casc',
      richtext: 'rt',
      group: 'grp'
    }
    const labelMap: Record<FieldType, string> = {
      input: '文本字段',
      number: '数字字段',
      textarea: '多行文本',
      select: '下拉选择',
      radio: '单选',
      checkbox: '多选',
      slider: '滑块',
      switch: '开关',
      date: '日期',
      time: '时间',
      rating: '评分',
      upload: '文件上传',
      cascader: '级联选择',
      richtext: '富文本',
      group: '分组'
    }
    const defaultValues: Partial<Record<FieldType, unknown>> = {
      input: '',
      number: 0,
      textarea: '',
      select: null,
      radio: null,
      checkbox: [],
      slider: 0,
      switch: false,
      date: '',
      time: '',
      rating: 0,
      upload: [],
      cascader: [],
      richtext: '',
      group: undefined
    }
    const config: FieldConfig = {
      defaultValue: defaultValues[type],
      placeholder: `请输入${labelMap[type]}`
    }
    switch (type) {
      case 'input':
        config.inputType = 'text'
        config.minLength = 0
        config.maxLength = 200
        break
      case 'textarea':
        config.rows = 4
        config.minLength = 0
        config.maxLength = 2000
        break
      case 'number':
        config.min = 0
        config.max = 1000000
        config.step = 1
        break
      case 'select':
      case 'radio':
      case 'checkbox':
        config.options = [
          { label: '选项1', value: 'opt1' },
          { label: '选项2', value: 'opt2' },
          { label: '选项3', value: 'opt3' }
        ]
        config.multiple = type === 'checkbox'
        config.searchable = type === 'select'
        config.inline = type === 'radio' || type === 'checkbox'
        break
      case 'slider':
        config.min = 0
        config.max = 100
        config.step = 1
        break
      case 'date':
      case 'time':
        config.format = type === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss'
        break
      case 'rating':
        config.max = 5
        config.allowHalf = false
        break
      case 'upload':
        config.accept = ''
        config.maxSize = 10
        config.maxCount = 5
        config.multiple = true
        break
      case 'cascader':
        config.cascaderOptions = defaultCascaderOptions
        config.placeholder = '请依次选择'
        break
      case 'richtext':
        config.toolbar = [
          'bold',
          'italic',
          'underline',
          'strikeThrough',
          'insertUnorderedList',
          'insertOrderedList',
          'justifyLeft',
          'justifyCenter',
          'justifyRight',
          'removeFormat'
        ]
        break
      case 'group':
        config.collapsed = false
        break
    }
    return {
      id,
      type,
      label: labelMap[type],
      name: `${prefixMap[type]}_${id}`,
      placeholder: config.placeholder as string,
      helpText: '',
      required: false,
      defaultValue: defaultValues[type],
      columnSpan: 1,
      cssClass: '',
      validation: [],
      linkageRules: [],
      config,
      children: type === 'group' ? [] : undefined
    }
  }

  const initFromStorage = () => store.initFromStorage()
  const resetSchema = (name?: string) => store.resetSchema(name)
  const selectField = (id: string | null) => store.selectField(id)
  const addField = (type: FieldType, position?: unknown) =>
    store.addField(createDefaultField(type), position as { parentId?: string | null; index?: number })
  const insertField = (field: SchemaField, position?: unknown) =>
    store.addField(field, position as { parentId?: string | null; index?: number })
  const removeField = (id: string) => store.removeField(id)
  const updateField = (id: string, patch: Partial<SchemaField>) => store.updateField(id, patch)
  const duplicateField = (id: string) => store.duplicateField(id)
  const moveField = (sourceId: string, pos: unknown) => store.moveField(sourceId, pos as { parentId?: string | null; index?: number; afterId?: string })
  const reorderUp = (id: string) => store.reorderField(id, 'up')
  const reorderDown = (id: string) => store.reorderField(id, 'down')
  const undo = () => store.undo()
  const redo = () => store.redo()
  const changeStatus = (s: FormStatus) => store.changeStatus(s)
  const showToast = (p: { type: 'success' | 'error' | 'warning' | 'info'; title?: string; message: string; duration?: number; id?: string }) => store.showToast(p)
  const dismissToast = (id: string) => store.dismissToast(id)
  const savePreset = (name: string, data: unknown) => store.savePreset(name, data)
  const removePreset = (id: string) => store.removePreset(id)

  function exportJSONSchema() {
    try {
      const exported = formSchemaToJSONSchema(store.schema)
      downloadJSONSchema(exported)
      store.showToast({
        type: 'success',
        title: '导出成功',
        message: `已导出 ${store.schema.fields.length} 个字段的 Schema`
      })
    } catch (e: unknown) {
      const err = e as Error
      store.showToast({
        type: 'error',
        title: '导出失败',
        message: err.message
      })
    }
  }

  function importJSON(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as Record<string, unknown>
          const { schema: migratedSchema, warnings } = migrateSchema(data, CURRENT_VERSION)
          store.pushUndo()
          store.schema = migratedSchema
          store.selectField(null)
          const msg =
            `已导入 ${migratedSchema.fields.length} 个字段` +
            (warnings.length ? `（${warnings.length} 条迁移警告）` : '')
          store.showToast({
            type: warnings.length ? 'warning' : 'success',
            title: '导入成功',
            message: msg
          })
          warnings.forEach(w => console.warn('[schema migrate]', w))
          resolve()
        } catch (e: unknown) {
          const err = e as Error
          store.showToast({
            type: 'error',
            title: '导入失败',
            message: err.message || 'JSON格式错误'
          })
          reject(e)
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }

  const validateOne = (f: SchemaField, v: unknown, all?: Record<string, unknown>) =>
    validateField(f, v, all)
  const validateAll = (values: Record<string, unknown>) =>
    validateAllFields(flatFields.value, values)
  const evalLinkage = (values: Record<string, unknown>) =>
    evaluateLinkageRules(
      flatFields.value,
      flatFields.value.flatMap(f =>
        ((f.linkages || []) as LinkageRule[]).map(r => ({
          ...r,
          triggerField: f.name
        }))
      ),
      values
    )

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    const isEditable =
      target &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
    const mod = e.ctrlKey || e.metaKey
    if (isEditable && !(mod && (e.key === 's' || e.key === 'z' || e.key === 'y' || e.key === 'p')))
      return

    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
      return
    }
    if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault()
      redo()
      return
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault()
      persistAndNotify()
      return
    }
    if (mod && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('fb:open-preview'))
      return
    }

    if (!isEditable && selectedFieldId.value) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        reorderUp(selectedFieldId.value)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        reorderDown(selectedFieldId.value)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeField(selectedFieldId.value)
        return
      }
    }
    if (!isEditable && e.key === 'Escape') {
      selectField(null)
    }
  }

  function persistAndNotify() {
    store.persistAll()
    store.showToast({
      type: 'success',
      title: '已保存',
      message: '表单已保存到本地存储'
    })
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    schema,
    fields,
    flatFields,
    fieldNames,
    selectedFieldId,
    selectedField,
    formStatus,
    canUndo,
    canRedo,
    presets,
    createDefaultField,
    initFromStorage,
    resetSchema,
    selectField,
    addField,
    insertField,
    removeField,
    updateField,
    duplicateField,
    moveField,
    reorderUp,
    reorderDown,
    undo,
    redo,
    changeStatus,
    persistAndNotify,
    showToast,
    dismissToast,
    savePreset,
    removePreset,
    exportJSONSchema,
    importJSON,
    validateOne,
    validateAll,
    evalLinkage,
    evaluateCondition,
    jsonSchemaToFormSchema
  }
}
