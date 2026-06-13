<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import {
  AlertCircle, Star, ChevronDown, ChevronUp, Upload, FileText, X,
  Calendar, Clock, LayoutGrid
} from 'lucide-vue-next'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'time'
  | 'rate'
  | 'upload'
  | 'group'
  | 'slider'
  | 'cascader'
  | 'richtext'

export interface FieldOption {
  label: string
  value: string | number
}

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  message?: string
  type?: 'email' | 'url' | 'phone' | 'idcard'
}

export interface LinkageCondition {
  field: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains' | 'empty' | 'notEmpty'
  value: unknown
}

export interface LinkageRule {
  conditions: LinkageCondition[]
  logic: 'AND' | 'OR'
  action: 'show' | 'hide' | 'enable' | 'disable' | 'setRequired' | 'setOptional'
}

export interface UploadedFile {
  name: string
  size: number
  type: string
}

export interface CascaderOption {
  label: string
  value: string | number
  children?: CascaderOption[]
}

export interface SchemaField {
  id: string
  type: FieldType
  label: string
  field: string
  placeholder?: string
  defaultValue?: unknown
  options?: FieldOption[]
  cascaderOptions?: CascaderOption[]
  rules?: ValidationRule
  linkages?: LinkageRule[]
  hint?: string
  inline?: boolean
  maxRate?: number
  min?: number
  max?: number
  step?: number
  accept?: string
  multiple?: boolean
  collapsed?: boolean
  children?: SchemaField[]
}

const props = defineProps<{
  schema: SchemaField[]
  modelValue: Record<string, unknown>
  readonly?: boolean
  preview?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void
  (e: 'validate', field: string, valid: boolean, error?: string): void
}>()

const localData = ref<Record<string, unknown>>({ ...props.modelValue })
const errors = ref<Record<string, string>>({})
const touchedFields = ref<Set<string>>(new Set())

watch(
  () => props.modelValue,
  (val) => {
    localData.value = { ...val }
  },
  { deep: true }
)

onMounted(() => {
  props.schema.forEach((field) => {
    if (!(field.field in localData.value) && field.defaultValue !== undefined && field.type !== 'group') {
      localData.value[field.field] = field.defaultValue
    }
  })
})

const getValue = (field: string): unknown => localData.value[field]

const setValue = (field: string, value: unknown) => {
  localData.value = { ...localData.value, [field]: value }
  emit('update:modelValue', { ...localData.value })
  validateField(findFieldByKey(field))
  touchedFields.value.add(field)
}

const findFieldByKey = (key: string): SchemaField | undefined => {
  const search = (fields: SchemaField[]): SchemaField | undefined => {
    for (const f of fields) {
      if (f.type === 'group' && f.children) {
        const found = search(f.children)
        if (found) return found
      }
      if (f.field === key) return f
    }
    return undefined
  }
  return search(props.schema)
}

const getAllFields = (fields: SchemaField[] = props.schema): SchemaField[] => {
  const result: SchemaField[] = []
  for (const f of fields) {
    if (f.type === 'group' && f.children) {
      result.push(...getAllFields(f.children))
    } else {
      result.push(f)
    }
  }
  return result
}

const evaluateCondition = (condition: LinkageCondition): boolean => {
  const value = getValue(condition.field)
  const condValue = condition.value

  switch (condition.operator) {
    case '==':
      return value === condValue
    case '!=':
      return value !== condValue
    case '>':
      return Number(value) > Number(condValue)
    case '<':
      return Number(value) < Number(condValue)
    case '>=':
      return Number(value) >= Number(condValue)
    case '<=':
      return Number(value) <= Number(condValue)
    case 'in': {
      const arr = Array.isArray(condValue) ? condValue : [condValue]
      return arr.includes(value as never)
    }
    case 'contains': {
      if (Array.isArray(value)) {
        return value.includes(condValue as never)
      }
      return String(value).includes(String(condValue))
    }
    case 'empty':
      return value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0)
    case 'notEmpty':
      return !(value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0))
    default:
      return false
  }
}

const evaluateLinkage = (linkages?: LinkageRule[]): {
  visible: boolean
  disabled: boolean
  required: boolean | null
} => {
  if (!linkages || linkages.length === 0) {
    return { visible: true, disabled: false, required: null }
  }

  let visible = true
  let disabled = false
  let required: boolean | null = null

  for (const rule of linkages) {
    let conditionResult: boolean
    if (rule.logic === 'AND') {
      conditionResult = rule.conditions.every(evaluateCondition)
    } else {
      conditionResult = rule.conditions.some(evaluateCondition)
    }

    switch (rule.action) {
      case 'show':
        if (!conditionResult) visible = false
        break
      case 'hide':
        if (conditionResult) visible = false
        break
      case 'enable':
        if (!conditionResult) disabled = true
        break
      case 'disable':
        if (conditionResult) disabled = true
        break
      case 'setRequired':
        if (conditionResult) required = true
        break
      case 'setOptional':
        if (conditionResult) required = false
        break
    }
  }

  return { visible, disabled, required }
}

const validateField = (field: SchemaField | undefined): boolean => {
  if (!field || field.type === 'group') return true

  const value = getValue(field.field)
  const linkage = evaluateLinkage(field.linkages)

  if (!linkage.visible) {
    errors.value[field.field] = ''
    emit('validate', field.field, true)
    return true
  }

  const effectiveRequired = linkage.required === null
    ? field.rules?.required ?? false
    : linkage.required

  if (effectiveRequired) {
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)

    if (isEmpty) {
      errors.value[field.field] = field.rules?.message || `${field.label}不能为空`
      emit('validate', field.field, false, errors.value[field.field])
      return false
    }
  }

  if (field.rules && value !== undefined && value !== null && value !== '') {
    const strValue = String(value)
    const numValue = Number(value)

    if (field.rules.minLength !== undefined && strValue.length < field.rules.minLength) {
      errors.value[field.field] = field.rules.message || `最少输入${field.rules.minLength}个字符`
      emit('validate', field.field, false, errors.value[field.field])
      return false
    }

    if (field.rules.maxLength !== undefined && strValue.length > field.rules.maxLength) {
      errors.value[field.field] = field.rules.message || `最多输入${field.rules.maxLength}个字符`
      emit('validate', field.field, false, errors.value[field.field])
      return false
    }

    if (field.rules.min !== undefined && numValue < field.rules.min) {
      errors.value[field.field] = field.rules.message || `最小值为${field.rules.min}`
      emit('validate', field.field, false, errors.value[field.field])
      return false
    }

    if (field.rules.max !== undefined && numValue > field.rules.max) {
      errors.value[field.field] = field.rules.message || `最大值为${field.rules.max}`
      emit('validate', field.field, false, errors.value[field.field])
      return false
    }

    if (field.rules.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(strValue)) {
        errors.value[field.field] = field.rules.message || '请输入正确的邮箱地址'
        emit('validate', field.field, false, errors.value[field.field])
        return false
      }
    }

    if (field.rules.type === 'phone') {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(strValue)) {
        errors.value[field.field] = field.rules.message || '请输入正确的手机号码'
        emit('validate', field.field, false, errors.value[field.field])
        return false
      }
    }

    if (field.rules.type === 'url') {
      const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
      if (!urlRegex.test(strValue)) {
        errors.value[field.field] = field.rules.message || '请输入正确的URL地址'
        emit('validate', field.field, false, errors.value[field.field])
        return false
      }
    }

    if (field.rules.type === 'idcard') {
      const idRegex = /(^\d{15}$)|(^\d{17}(\d|X|x)$)/
      if (!idRegex.test(strValue)) {
        errors.value[field.field] = field.rules.message || '请输入正确的身份证号'
        emit('validate', field.field, false, errors.value[field.field])
        return false
      }
    }

    if (field.rules.pattern) {
      try {
        const regex = new RegExp(field.rules.pattern)
        if (!regex.test(strValue)) {
          errors.value[field.field] = field.rules.message || '格式不正确'
          emit('validate', field.field, false, errors.value[field.field])
          return false
        }
      } catch {
        // 忽略无效正则
      }
    }
  }

  errors.value[field.field] = ''
  emit('validate', field.field, true)
  return true
}

const validateAll = (): boolean => {
  let allValid = true
  const allFields = getAllFields()
  allFields.forEach((f) => {
    touchedFields.value.add(f.field)
    if (!validateField(f)) {
      allValid = false
    }
  })
  return allValid
}

defineExpose({
  validateAll,
  errors
})

const showError = (field: SchemaField): boolean => {
  return touchedFields.value.has(field.field) && Boolean(errors.value[field.field])
}

const handleInput = (field: SchemaField, value: unknown) => {
  setValue(field.field, value)
}

const handleBlur = (field: SchemaField) => {
  touchedFields.value.add(field.field)
  validateField(field)
}

const groupCollapsed = ref<Record<string, boolean>>({})

const toggleGroup = (groupId: string) => {
  groupCollapsed.value[groupId] = !groupCollapsed.value[groupId]
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const handleUpload = (field: SchemaField, event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  const files: UploadedFile[] = []
  for (let i = 0; i < input.files.length; i++) {
    const f = input.files[i]
    files.push({ name: f.name, size: f.size, type: f.type })
  }

  if (field.multiple) {
    const current = (getValue(field.field) as UploadedFile[] | undefined) || []
    handleInput(field, [...current, ...files])
  } else {
    handleInput(field, files[0])
  }
}

const removeFile = (field: SchemaField, index?: number) => {
  if (field.multiple && index !== undefined) {
    const current = (getValue(field.field) as UploadedFile[] | undefined) || []
    handleInput(field, current.filter((_, i) => i !== index))
  } else {
    handleInput(field, undefined)
  }
}

const hoverRating = ref<Record<string, number>>({})

const setHoverRating = (fieldId: string, value: number) => {
  hoverRating.value[fieldId] = value
}

const clearHoverRating = (fieldId: string) => {
  hoverRating.value[fieldId] = 0
}

const cascaderOpen = ref<Record<string, boolean>>({})

const getCascaderLevelOptions = (field: SchemaField, levelIdx: number): CascaderOption[] => {
  const options = field.cascaderOptions || []
  const value = (getValue(field.field) as (string | number)[] | undefined) || []
  if (levelIdx === 0) return options
  let currentOptions: CascaderOption[] = options
  for (let i = 0; i < levelIdx; i++) {
    const selected = value[i]
    const found = currentOptions.find(o => o.value === selected)
    if (found?.children) {
      currentOptions = found.children
    } else {
      return []
    }
  }
  return currentOptions
}

const getCascaderMaxLevel = (field: SchemaField): number => {
  let maxLevel = 0
  const walk = (options: CascaderOption[], level: number) => {
    maxLevel = Math.max(maxLevel, level)
    options.forEach(o => {
      if (o.children && o.children.length > 0) {
        walk(o.children, level + 1)
      }
    })
  }
  walk(field.cascaderOptions || [], 1)
  return maxLevel
}

const selectCascaderOption = (field: SchemaField, levelIdx: number, optValue: string | number) => {
  const currentValue = ((getValue(field.field) as (string | number)[] | undefined) || []).slice(0, levelIdx)
  currentValue[levelIdx] = optValue
  const nextOptions = getCascaderLevelOptions(field, levelIdx).find(o => o.value === optValue)
  if (!nextOptions?.children || nextOptions.children.length === 0) {
    cascaderOpen.value[field.id] = false
  }
  handleInput(field, currentValue)
}

const getCascaderLabel = (field: SchemaField): string => {
  const value = (getValue(field.field) as (string | number)[] | undefined) || []
  if (value.length === 0) return field.placeholder || '请选择'
  const options = field.cascaderOptions || []
  const labels: string[] = []
  let currentOptions: CascaderOption[] = options
  for (let i = 0; i < value.length; i++) {
    const found = currentOptions.find(o => o.value === value[i])
    if (found) {
      labels.push(found.label)
      currentOptions = found.children || []
    } else {
      break
    }
  }
  return labels.join(' / ')
}

const toggleCascader = (fieldId: string) => {
  Object.keys(cascaderOpen.value).forEach(k => {
    if (k !== fieldId) cascaderOpen.value[k] = false
  })
  cascaderOpen.value[fieldId] = !cascaderOpen.value[fieldId]
}

const execCommand = (field: SchemaField, command: string, value?: string) => {
  document.execCommand(command, false, value)
  const el = document.querySelector(`[data-richtext="${field.field}"]`) as HTMLElement | null
  if (el) {
    handleInput(field, el.innerHTML)
  }
}
</script>

<template>
  <div>
    <template v-for="field in schema" :key="field.id">
      <template v-if="field.type === 'group'">
        <div class="form-group">
          <div class="form-group-header" @click="toggleGroup(field.id)">
            <div class="form-group-title">
              <LayoutGrid :size="18" style="color: var(--primary-color);" />
              {{ field.label }}
            </div>
            <ChevronDown v-if="groupCollapsed[field.id] ?? field.collapsed" :size="18" style="color: var(--text-muted);" />
            <ChevronUp v-else :size="18" style="color: var(--text-muted);" />
          </div>
          <div :class="['form-group-body', { collapsed: groupCollapsed[field.id] ?? field.collapsed }]">
            <template v-for="child in field.children" :key="child.id">
              <template v-if="child.type !== 'group'">
                <div
                  v-if="evaluateLinkage(child.linkages).visible"
                  :class="['form-field', { 'form-field-error': showError(child) }]"
                >
                  <div class="form-field-label">
                    <span
                      v-if="(evaluateLinkage(child.linkages).required === null
                        ? child.rules?.required ?? false
                        : evaluateLinkage(child.linkages).required)"
                      class="form-field-required"
                    >*</span>
                    {{ child.label }}
                  </div>

                  <!-- text -->
                  <input
                    v-if="child.type === 'text'"
                    class="form-field-input"
                    type="text"
                    :value="getValue(child.field) as string"
                    :placeholder="child.placeholder"
                    :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                    @input="(e) => handleInput(child, (e.target as HTMLInputElement).value)"
                    @blur="handleBlur(child)"
                  />

                  <!-- number -->
                  <input
                    v-else-if="child.type === 'number'"
                    class="form-field-input"
                    type="number"
                    :value="getValue(child.field) as number"
                    :placeholder="child.placeholder"
                    :min="child.min"
                    :max="child.max"
                    :step="child.step"
                    :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                    @input="(e) => handleInput(child, Number((e.target as HTMLInputElement).value))"
                    @blur="handleBlur(child)"
                  />

                  <!-- textarea -->
                  <textarea
                    v-else-if="child.type === 'textarea'"
                    class="form-field-textarea"
                    :value="getValue(child.field) as string"
                    :placeholder="child.placeholder"
                    :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                    @input="(e) => handleInput(child, (e.target as HTMLTextAreaElement).value)"
                    @blur="handleBlur(child)"
                  />

                  <!-- select -->
                  <select
                    v-else-if="child.type === 'select'"
                    class="form-field-select"
                    :value="getValue(child.field) as string | number"
                    :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                    @change="(e) => handleInput(child, (e.target as HTMLSelectElement).value)"
                    @blur="handleBlur(child)"
                  >
                    <option value="" disabled>{{ child.placeholder || '请选择' }}</option>
                    <option v-for="opt in child.options" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>

                  <!-- radio -->
                  <div v-else-if="child.type === 'radio'" :class="['form-field-radio-group', { inline: child.inline }]">
                    <label v-for="opt in child.options" :key="opt.value" class="form-field-radio">
                      <input
                        type="radio"
                        :name="child.field"
                        :value="opt.value"
                        :checked="getValue(child.field) === opt.value"
                        :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                        @change="handleInput(child, opt.value)"
                      />
                      <span>{{ opt.label }}</span>
                    </label>
                  </div>

                  <!-- checkbox -->
                  <div v-else-if="child.type === 'checkbox'" :class="['form-field-checkbox-group', { inline: child.inline }]">
                    <label v-for="opt in child.options" :key="opt.value" class="form-field-checkbox">
                      <input
                        type="checkbox"
                        :checked="((getValue(child.field) as (string | number)[]) || []).includes(opt.value)"
                        :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                        @change="(() => {
                          const current = (getValue(child.field) as (string | number)[]) || []
                          const idx = current.indexOf(opt.value)
                          const newVal = idx > -1
                            ? current.filter(v => v !== opt.value)
                            : [...current, opt.value]
                          handleInput(child, newVal)
                        })()"
                      />
                      <span>{{ opt.label }}</span>
                    </label>
                  </div>

                  <!-- switch -->
                  <div
                    v-else-if="child.type === 'switch'"
                    :class="['form-field-switch', { active: Boolean(getValue(child.field)) }]"
                    @click="!evaluateLinkage(child.linkages).disabled && !readonly && handleInput(child, !Boolean(getValue(child.field)))"
                  >
                    <div class="form-field-switch-thumb" />
                  </div>

                  <!-- date -->
                  <div v-else-if="child.type === 'date'" class="form-field-datetime-row">
                    <input
                      class="form-field-input"
                      type="date"
                      :value="getValue(child.field) as string"
                      :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                      @input="(e) => handleInput(child, (e.target as HTMLInputElement).value)"
                      @blur="handleBlur(child)"
                    />
                    <Calendar class="field-card-icon" style="align-self: center; color: var(--text-muted);" />
                  </div>

                  <!-- time -->
                  <div v-else-if="child.type === 'time'" class="form-field-datetime-row">
                    <input
                      class="form-field-input"
                      type="time"
                      :value="getValue(child.field) as string"
                      :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                      @input="(e) => handleInput(child, (e.target as HTMLInputElement).value)"
                      @blur="handleBlur(child)"
                    />
                    <Clock class="field-card-icon" style="align-self: center; color: var(--text-muted);" />
                  </div>

                  <!-- rate -->
                  <div v-else-if="child.type === 'rate'" class="form-field-rate" @mouseleave="clearHoverRating(child.id)">
                    <template v-for="n in (child.maxRate || 5)" :key="n">
                      <Star
                        class="rate-star"
                        :class="{ active: n <= ((hoverRating[child.id] || 0) || ((getValue(child.field) as number) || 0)) }"
                        :size="24"
                        :fill="n <= ((hoverRating[child.id] || 0) || ((getValue(child.field) as number) || 0)) ? 'currentColor' : 'none'"
                        @mouseenter="!evaluateLinkage(child.linkages).disabled && !readonly && setHoverRating(child.id, n)"
                        @click="!evaluateLinkage(child.linkages).disabled && !readonly && handleInput(child, n === (getValue(child.field) as number || 0) ? n - 1 : n)"
                      />
                    </template>
                  </div>

                  <!-- upload -->
                  <div v-else-if="child.type === 'upload'">
                    <label
                      class="form-field-upload"
                      :style="(evaluateLinkage(child.linkages).disabled || readonly) ? 'opacity: 0.5; cursor: not-allowed;' : ''"
                    >
                      <Upload :size="32" />
                      <span>{{ child.placeholder || '点击上传文件' }}</span>
                      <span style="font-size: 12px; color: var(--text-muted);" v-if="child.accept">
                        支持格式: {{ child.accept }}
                      </span>
                      <input
                        type="file"
                        :accept="child.accept"
                        :multiple="child.multiple"
                        style="display: none"
                        :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                        @change="(e) => handleUpload(child, e)"
                      />
                    </label>
                    <div v-if="child.multiple && Array.isArray(getValue(child.field)) && (getValue(child.field) as UploadedFile[]).length > 0" class="upload-file-list">
                      <div v-for="(f, i) in getValue(child.field) as UploadedFile[]" :key="i" class="upload-file-item">
                        <div class="upload-file-item-left">
                          <FileText :size="16" style="color: var(--primary-color);" />
                          <span>{{ f.name }}</span>
                          <span style="color: var(--text-muted);">{{ formatFileSize(f.size) }}</span>
                        </div>
                        <div
                          v-if="!evaluateLinkage(child.linkages).disabled && !readonly"
                          class="toast-close"
                          @click="removeFile(child, i)"
                        >
                          <X :size="14" />
                        </div>
                      </div>
                    </div>
                    <div v-else-if="!child.multiple && getValue(child.field) && !Array.isArray(getValue(child.field))" class="upload-file-list">
                      <div class="upload-file-item">
                        <div class="upload-file-item-left">
                          <FileText :size="16" style="color: var(--primary-color);" />
                          <span>{{ (getValue(child.field) as UploadedFile).name }}</span>
                          <span style="color: var(--text-muted);">{{ formatFileSize((getValue(child.field) as UploadedFile).size) }}</span>
                        </div>
                        <div
                          v-if="!evaluateLinkage(child.linkages).disabled && !readonly"
                          class="toast-close"
                          @click="removeFile(child)"
                        >
                          <X :size="14" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- slider -->
                  <div v-else-if="child.type === 'slider'" class="form-field-slider">
                    <div class="slider-track" :disabled="evaluateLinkage(child.linkages).disabled || readonly">
                      <div
                        class="slider-fill"
                        :style="{
                          width: `${Math.max(0, Math.min(100, (
                            ((Number(getValue(child.field)) || 0) - (child.min ?? 0)) /
                            Math.max(1, ((child.max ?? 100) - (child.min ?? 0)))
                          ) * 100))}%`
                        }"
                      />
                      <input
                        type="range"
                        class="slider-input"
                        :min="child.min ?? 0"
                        :max="child.max ?? 100"
                        :step="child.step ?? 1"
                        :value="Number(getValue(child.field)) || 0"
                        :disabled="evaluateLinkage(child.linkages).disabled || readonly"
                        @input="(e) => handleInput(child, Number((e.target as HTMLInputElement).value))"
                        @change="handleBlur(child)"
                      />
                    </div>
                    <span class="slider-value">{{ Number(getValue(child.field)) || 0 }}</span>
                  </div>

                  <!-- cascader -->
                  <div v-else-if="child.type === 'cascader'" class="form-field-cascader">
                    <div
                      class="cascader-trigger"
                      :class="{ disabled: evaluateLinkage(child.linkages).disabled || readonly, open: cascaderOpen[child.id] }"
                      @click="!evaluateLinkage(child.linkages).disabled && !readonly && toggleCascader(child.id)"
                    >
                      <span :class="{ placeholder: !getValue(child.field) || ((getValue(child.field) as any[] | undefined)?.length ?? 0) === 0 }">
                        {{ getCascaderLabel(child) }}
                      </span>
                      <ChevronDown :size="16" class="cascader-arrow" :class="{ open: cascaderOpen[child.id] }" />
                    </div>
                    <div v-if="cascaderOpen[child.id]" class="cascader-dropdown" @click.stop>
                      <div class="cascader-panels">
                        <div
                          v-for="lv in getCascaderMaxLevel(child)"
                          :key="lv - 1"
                          class="cascader-panel"
                        >
                          <div
                            v-for="opt in getCascaderLevelOptions(child, lv - 1)"
                            :key="opt.value"
                            :class="['cascader-option', {
                              selected: (getValue(child.field) as any[] | undefined)?.[lv - 1] === opt.value,
                              hasChildren: opt.children && opt.children.length > 0
                            }]"
                            @click="selectCascaderOption(child, lv - 1, opt.value)"
                          >
                            <span>{{ opt.label }}</span>
                            <ChevronDown
                              v-if="opt.children && opt.children.length > 0"
                              :size="14"
                              style="transform: rotate(-90deg); opacity: 0.5;"
                            />
                          </div>
                          <div
                            v-if="getCascaderLevelOptions(child, lv - 1).length === 0"
                            style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;"
                          >
                            请先选择上一级
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- richtext -->
                  <div v-else-if="child.type === 'richtext'" class="form-field-richtext">
                    <div
                      v-if="!evaluateLinkage(child.linkages).disabled && !readonly"
                      class="richtext-toolbar"
                    >
                      <button type="button" class="richtext-btn" title="加粗" @click="execCommand(child, 'bold')"><b>B</b></button>
                      <button type="button" class="richtext-btn" title="斜体" @click="execCommand(child, 'italic')"><i>I</i></button>
                      <button type="button" class="richtext-btn" title="下划线" @click="execCommand(child, 'underline')"><u>U</u></button>
                      <button type="button" class="richtext-btn" title="删除线" @click="execCommand(child, 'strikeThrough')"><s>S</s></button>
                      <span class="richtext-sep" />
                      <button type="button" class="richtext-btn" title="无序列表" @click="execCommand(child, 'insertUnorderedList')">• 列表</button>
                      <button type="button" class="richtext-btn" title="有序列表" @click="execCommand(child, 'insertOrderedList')">1. 列表</button>
                      <span class="richtext-sep" />
                      <button type="button" class="richtext-btn" title="左对齐" @click="execCommand(child, 'justifyLeft')">⬅</button>
                      <button type="button" class="richtext-btn" title="居中" @click="execCommand(child, 'justifyCenter')">⬌</button>
                      <button type="button" class="richtext-btn" title="右对齐" @click="execCommand(child, 'justifyRight')">➡</button>
                      <span class="richtext-sep" />
                      <button type="button" class="richtext-btn" title="清除格式" @click="execCommand(child, 'removeFormat')">清除格式</button>
                    </div>
                    <div
                      class="richtext-editor"
                      :class="{ readonly: evaluateLinkage(child.linkages).disabled || readonly }"
                      contenteditable="true"
                      :data-richtext="child.field"
                      :innerHTML="(getValue(child.field) as string) || ''"
                      @input="(e) => handleInput(child, (e.target as HTMLElement).innerHTML)"
                      @blur="handleBlur(child)"
                    />
                  </div>

                  <div v-if="showError(child)" class="form-field-error-msg">
                    <AlertCircle :size="14" />
                    {{ errors[child.field] }}
                  </div>
                  <div v-else-if="child.hint" class="form-field-hint">{{ child.hint }}</div>
                </div>
              </template>
            </template>
          </div>
        </div>
      </template>

      <template v-else>
        <div
          v-if="evaluateLinkage(field.linkages).visible"
          :class="['form-field', { 'form-field-error': showError(field) }]"
        >
          <div class="form-field-label">
            <span
              v-if="(evaluateLinkage(field.linkages).required === null
                ? field.rules?.required ?? false
                : evaluateLinkage(field.linkages).required)"
              class="form-field-required"
            >*</span>
            {{ field.label }}
          </div>

          <!-- text -->
          <input
            v-if="field.type === 'text'"
            class="form-field-input"
            type="text"
            :value="getValue(field.field) as string"
            :placeholder="field.placeholder"
            :disabled="evaluateLinkage(field.linkages).disabled || readonly"
            @input="(e) => handleInput(field, (e.target as HTMLInputElement).value)"
            @blur="handleBlur(field)"
          />

          <!-- number -->
          <input
            v-else-if="field.type === 'number'"
            class="form-field-input"
            type="number"
            :value="getValue(field.field) as number"
            :placeholder="field.placeholder"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            :disabled="evaluateLinkage(field.linkages).disabled || readonly"
            @input="(e) => handleInput(field, Number((e.target as HTMLInputElement).value))"
            @blur="handleBlur(field)"
          />

          <!-- textarea -->
          <textarea
            v-else-if="field.type === 'textarea'"
            class="form-field-textarea"
            :value="getValue(field.field) as string"
            :placeholder="field.placeholder"
            :disabled="evaluateLinkage(field.linkages).disabled || readonly"
            @input="(e) => handleInput(field, (e.target as HTMLTextAreaElement).value)"
            @blur="handleBlur(field)"
          />

          <!-- select -->
          <select
            v-else-if="field.type === 'select'"
            class="form-field-select"
            :value="getValue(field.field) as string | number"
            :disabled="evaluateLinkage(field.linkages).disabled || readonly"
            @change="(e) => handleInput(field, (e.target as HTMLSelectElement).value)"
            @blur="handleBlur(field)"
          >
            <option value="" disabled>{{ field.placeholder || '请选择' }}</option>
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <!-- radio -->
          <div v-else-if="field.type === 'radio'" :class="['form-field-radio-group', { inline: field.inline }]">
            <label v-for="opt in field.options" :key="opt.value" class="form-field-radio">
              <input
                type="radio"
                :name="field.field"
                :value="opt.value"
                :checked="getValue(field.field) === opt.value"
                :disabled="evaluateLinkage(field.linkages).disabled || readonly"
                @change="handleInput(field, opt.value)"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>

          <!-- checkbox -->
          <div v-else-if="field.type === 'checkbox'" :class="['form-field-checkbox-group', { inline: field.inline }]">
            <label v-for="opt in field.options" :key="opt.value" class="form-field-checkbox">
              <input
                type="checkbox"
                :checked="((getValue(field.field) as (string | number)[]) || []).includes(opt.value)"
                :disabled="evaluateLinkage(field.linkages).disabled || readonly"
                @change="(() => {
                  const current = (getValue(field.field) as (string | number)[]) || []
                  const idx = current.indexOf(opt.value)
                  const newVal = idx > -1
                    ? current.filter(v => v !== opt.value)
                    : [...current, opt.value]
                  handleInput(field, newVal)
                })()"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>

          <!-- switch -->
          <div
            v-else-if="field.type === 'switch'"
            :class="['form-field-switch', { active: Boolean(getValue(field.field)) }]"
            @click="!evaluateLinkage(field.linkages).disabled && !readonly && handleInput(field, !Boolean(getValue(field.field)))"
          >
            <div class="form-field-switch-thumb" />
          </div>

          <!-- date -->
          <div v-else-if="field.type === 'date'" class="form-field-datetime-row">
            <input
              class="form-field-input"
              type="date"
              :value="getValue(field.field) as string"
              :disabled="evaluateLinkage(field.linkages).disabled || readonly"
              @input="(e) => handleInput(field, (e.target as HTMLInputElement).value)"
              @blur="handleBlur(field)"
            />
            <Calendar class="field-card-icon" style="align-self: center; color: var(--text-muted);" />
          </div>

          <!-- time -->
          <div v-else-if="field.type === 'time'" class="form-field-datetime-row">
            <input
              class="form-field-input"
              type="time"
              :value="getValue(field.field) as string"
              :disabled="evaluateLinkage(field.linkages).disabled || readonly"
              @input="(e) => handleInput(field, (e.target as HTMLInputElement).value)"
              @blur="handleBlur(field)"
            />
            <Clock class="field-card-icon" style="align-self: center; color: var(--text-muted);" />
          </div>

          <!-- rate -->
          <div v-else-if="field.type === 'rate'" class="form-field-rate" @mouseleave="clearHoverRating(field.id)">
            <template v-for="n in (field.maxRate || 5)" :key="n">
              <Star
                class="rate-star"
                :class="{ active: n <= ((hoverRating[field.id] || 0) || ((getValue(field.field) as number) || 0)) }"
                :size="24"
                :fill="n <= ((hoverRating[field.id] || 0) || ((getValue(field.field) as number) || 0)) ? 'currentColor' : 'none'"
                @mouseenter="!evaluateLinkage(field.linkages).disabled && !readonly && setHoverRating(field.id, n)"
                @click="!evaluateLinkage(field.linkages).disabled && !readonly && handleInput(field, n === (getValue(field.field) as number || 0) ? n - 1 : n)"
              />
            </template>
          </div>

          <!-- upload -->
          <div v-else-if="field.type === 'upload'">
            <label
              class="form-field-upload"
              :style="(evaluateLinkage(field.linkages).disabled || readonly) ? 'opacity: 0.5; cursor: not-allowed;' : ''"
            >
              <Upload :size="32" />
              <span>{{ field.placeholder || '点击上传文件' }}</span>
              <span style="font-size: 12px; color: var(--text-muted);" v-if="field.accept">
                支持格式: {{ field.accept }}
              </span>
              <input
                type="file"
                :accept="field.accept"
                :multiple="field.multiple"
                style="display: none"
                :disabled="evaluateLinkage(field.linkages).disabled || readonly"
                @change="(e) => handleUpload(field, e)"
              />
            </label>
            <div v-if="field.multiple && Array.isArray(getValue(field.field)) && (getValue(field.field) as UploadedFile[]).length > 0" class="upload-file-list">
              <div v-for="(f, i) in getValue(field.field) as UploadedFile[]" :key="i" class="upload-file-item">
                <div class="upload-file-item-left">
                  <FileText :size="16" style="color: var(--primary-color);" />
                  <span>{{ f.name }}</span>
                  <span style="color: var(--text-muted);">{{ formatFileSize(f.size) }}</span>
                </div>
                <div
                  v-if="!evaluateLinkage(field.linkages).disabled && !readonly"
                  class="toast-close"
                  @click="removeFile(field, i)"
                >
                  <X :size="14" />
                </div>
              </div>
            </div>
            <div v-else-if="!field.multiple && getValue(field.field) && !Array.isArray(getValue(field.field))" class="upload-file-list">
              <div class="upload-file-item">
                <div class="upload-file-item-left">
                  <FileText :size="16" style="color: var(--primary-color);" />
                  <span>{{ (getValue(field.field) as UploadedFile).name }}</span>
                  <span style="color: var(--text-muted);">{{ formatFileSize((getValue(field.field) as UploadedFile).size) }}</span>
                </div>
                <div
                  v-if="!evaluateLinkage(field.linkages).disabled && !readonly"
                  class="toast-close"
                  @click="removeFile(field)"
                >
                  <X :size="14" />
                </div>
              </div>
            </div>
          </div>

          <!-- slider -->
          <div v-else-if="field.type === 'slider'" class="form-field-slider">
            <div class="slider-track" :disabled="evaluateLinkage(field.linkages).disabled || readonly">
              <div
                class="slider-fill"
                :style="{
                  width: `${Math.max(0, Math.min(100, (
                    ((Number(getValue(field.field)) || 0) - (field.min ?? 0)) /
                    Math.max(1, ((field.max ?? 100) - (field.min ?? 0)))
                  ) * 100))}%`
                }"
              />
              <input
                type="range"
                class="slider-input"
                :min="field.min ?? 0"
                :max="field.max ?? 100"
                :step="field.step ?? 1"
                :value="Number(getValue(field.field)) || 0"
                :disabled="evaluateLinkage(field.linkages).disabled || readonly"
                @input="(e) => handleInput(field, Number((e.target as HTMLInputElement).value))"
                @change="handleBlur(field)"
              />
            </div>
            <span class="slider-value">{{ Number(getValue(field.field)) || 0 }}</span>
          </div>

          <!-- cascader -->
          <div v-else-if="field.type === 'cascader'" class="form-field-cascader">
            <div
              class="cascader-trigger"
              :class="{ disabled: evaluateLinkage(field.linkages).disabled || readonly, open: cascaderOpen[field.id] }"
              @click="!evaluateLinkage(field.linkages).disabled && !readonly && toggleCascader(field.id)"
            >
              <span :class="{ placeholder: !getValue(field.field) || ((getValue(field.field) as any[] | undefined)?.length ?? 0) === 0 }">
                {{ getCascaderLabel(field) }}
              </span>
              <ChevronDown :size="16" class="cascader-arrow" :class="{ open: cascaderOpen[field.id] }" />
            </div>
            <div v-if="cascaderOpen[field.id]" class="cascader-dropdown" @click.stop>
              <div class="cascader-panels">
                <div
                  v-for="lv in getCascaderMaxLevel(field)"
                  :key="lv - 1"
                  class="cascader-panel"
                >
                  <div
                    v-for="opt in getCascaderLevelOptions(field, lv - 1)"
                    :key="opt.value"
                    :class="['cascader-option', {
                      selected: (getValue(field.field) as any[] | undefined)?.[lv - 1] === opt.value,
                      hasChildren: opt.children && opt.children.length > 0
                    }]"
                    @click="selectCascaderOption(field, lv - 1, opt.value)"
                  >
                    <span>{{ opt.label }}</span>
                    <ChevronDown
                      v-if="opt.children && opt.children.length > 0"
                      :size="14"
                      style="transform: rotate(-90deg); opacity: 0.5;"
                    />
                  </div>
                  <div
                    v-if="getCascaderLevelOptions(field, lv - 1).length === 0"
                    style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;"
                  >
                    请先选择上一级
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- richtext -->
          <div v-else-if="field.type === 'richtext'" class="form-field-richtext">
            <div
              v-if="!evaluateLinkage(field.linkages).disabled && !readonly"
              class="richtext-toolbar"
            >
              <button type="button" class="richtext-btn" title="加粗" @click="execCommand(field, 'bold')"><b>B</b></button>
              <button type="button" class="richtext-btn" title="斜体" @click="execCommand(field, 'italic')"><i>I</i></button>
              <button type="button" class="richtext-btn" title="下划线" @click="execCommand(field, 'underline')"><u>U</u></button>
              <button type="button" class="richtext-btn" title="删除线" @click="execCommand(field, 'strikeThrough')"><s>S</s></button>
              <span class="richtext-sep" />
              <button type="button" class="richtext-btn" title="无序列表" @click="execCommand(field, 'insertUnorderedList')">• 列表</button>
              <button type="button" class="richtext-btn" title="有序列表" @click="execCommand(field, 'insertOrderedList')">1. 列表</button>
              <span class="richtext-sep" />
              <button type="button" class="richtext-btn" title="左对齐" @click="execCommand(field, 'justifyLeft')">⬅</button>
              <button type="button" class="richtext-btn" title="居中" @click="execCommand(field, 'justifyCenter')">⬌</button>
              <button type="button" class="richtext-btn" title="右对齐" @click="execCommand(field, 'justifyRight')">➡</button>
              <span class="richtext-sep" />
              <button type="button" class="richtext-btn" title="清除格式" @click="execCommand(field, 'removeFormat')">清除格式</button>
            </div>
            <div
              class="richtext-editor"
              :class="{ readonly: evaluateLinkage(field.linkages).disabled || readonly }"
              contenteditable="true"
              :data-richtext="field.field"
              :innerHTML="(getValue(field.field) as string) || ''"
              @input="(e) => handleInput(field, (e.target as HTMLElement).innerHTML)"
              @blur="handleBlur(field)"
            />
          </div>

          <div v-if="showError(field)" class="form-field-error-msg">
            <AlertCircle :size="14" />
            {{ errors[field.field] }}
          </div>
          <div v-else-if="field.hint" class="form-field-hint">{{ field.hint }}</div>
        </div>
      </template>
    </template>
  </div>
</template>
