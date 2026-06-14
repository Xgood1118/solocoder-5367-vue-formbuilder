<script setup lang="ts">
defineOptions({
  name: 'PropertyPanel'
})

import { ref, computed } from 'vue'
import {
  Settings,
  GitBranch,
  Plus,
  X,
  Trash2,
  Type
} from 'lucide-vue-next'
import { useFormStore } from '@/stores/formStore'
import { generateId } from '@/utils/schemaConverter'
import type {
  SchemaField,
  FieldType,
  FieldOption,
  CascaderOption,
  ValidationRule,
  ValidationRuleType,
  LinkageRule,
  LinkageCondition,
  LinkageAction,
  LinkageOperator,
  LinkageActionType
} from '@/types'

const store = useFormStore()

const activeTab = ref<'properties' | 'linkage'>('properties')
const expandedRules = ref<Set<string>>(new Set())

const field = computed(() => store.selectedField)
const fieldId = computed(() => store.selectedFieldId)

const allFields = computed((): SchemaField[] => {
  const result: SchemaField[] = []
  const walk = (fields: SchemaField[]) => {
    for (const f of fields) {
      if (f.id !== fieldId.value) {
        result.push(f)
      }
      if (f.children?.length) {
        walk(f.children)
      }
    }
  }
  walk(store.fields)
  return result
})

function updateField(patch: Partial<SchemaField>) {
  if (!fieldId.value) return
  store.updateField(fieldId.value, patch)
}

function getValidationRules(): ValidationRule[] {
  if (!field.value) return []
  if (Array.isArray(field.value.validation)) return field.value.validation
  if (Array.isArray(field.value.rules)) return field.value.rules
  return []
}

function hasValidationRule(type: ValidationRuleType): boolean {
  return getValidationRules().some(r => r.type === type)
}

function getValidationRule(type: ValidationRuleType): ValidationRule | undefined {
  return getValidationRules().find(r => r.type === type)
}

function setValidationRules(rules: ValidationRule[]) {
  updateField({ validation: rules, rules: undefined })
}

function toggleValidationRule(type: ValidationRuleType) {
  if (!field.value) return
  const rules = [...getValidationRules()]
  const idx = rules.findIndex(r => r.type === type)
  if (idx > -1) {
    rules.splice(idx, 1)
  } else {
    rules.push({ type })
  }
  setValidationRules(rules)
}

function updateValidationRuleValue(type: ValidationRuleType, value: unknown) {
  if (!field.value) return
  const rules = [...getValidationRules()]
  const idx = rules.findIndex(r => r.type === type)
  if (idx > -1) {
    rules[idx] = { ...rules[idx], value }
    setValidationRules(rules)
  }
}

function updateValidationRuleMessage(type: ValidationRuleType, message: string) {
  if (!field.value) return
  const rules = [...getValidationRules()]
  const idx = rules.findIndex(r => r.type === type)
  if (idx > -1) {
    rules[idx] = { ...rules[idx], message }
    setValidationRules(rules)
  }
}

function isRequired(): boolean {
  return hasValidationRule('required') || (field.value?.config?.required === true)
}

function toggleRequired() {
  const currentlyRequired = isRequired()
  if (currentlyRequired) {
    const rules = getValidationRules().filter(r => r.type !== 'required')
    setValidationRules(rules)
    const config = { ...(field.value?.config || {}), required: false }
    updateField({ config })
  } else {
    const rules = [...getValidationRules()]
    if (!rules.some(r => r.type === 'required')) {
      rules.unshift({ type: 'required' })
    }
    setValidationRules(rules)
    const config = { ...(field.value?.config || {}), required: true }
    updateField({ config })
  }
}

const toolbarOptions: { key: string; label: string }[] = [
  { key: 'bold', label: '加粗' },
  { key: 'italic', label: '斜体' },
  { key: 'underline', label: '下划线' },
  { key: 'strikeThrough', label: '删除线' },
  { key: 'insertUnorderedList', label: '无序列表' },
  { key: 'insertOrderedList', label: '有序列表' },
  { key: 'justifyLeft', label: '左对齐' },
  { key: 'justifyCenter', label: '居中' },
  { key: 'justifyRight', label: '右对齐' }
]

function getToolbar(): string[] {
  const config = field.value?.config
  const tb = (config as Record<string, unknown> | undefined)?.toolbar as string[] | undefined
  if (!tb || !Array.isArray(tb)) {
    return toolbarOptions.map(t => t.key)
  }
  return tb
}

function toggleToolbar(key: string) {
  if (!field.value) return
  const current = getToolbar()
  const newToolbar = current.includes(key)
    ? current.filter(k => k !== key)
    : [...current, key]
  const config = { ...(field.value.config || {}), toolbar: newToolbar }
  updateField({ config })
}

function getOptions(): FieldOption[] {
  return field.value?.options || []
}

function updateOption(index: number, key: 'label' | 'value', val: string | number) {
  if (!field.value) return
  const options = [...getOptions()]
  options[index] = { ...options[index], [key]: val }
  updateField({ options })
}

function addOption() {
  if (!field.value) return
  const options = [...getOptions(), { label: `选项${getOptions().length + 1}`, value: generateId() }]
  updateField({ options })
}

function removeOption(index: number) {
  if (!field.value) return
  const options = getOptions().filter((_, i) => i !== index)
  updateField({ options })
}

function getCascaderOptions(): CascaderOption[] {
  return field.value?.cascaderOptions || []
}

function addCascaderOption(parent?: CascaderOption) {
  if (!field.value) return
  const newOpt: CascaderOption = { label: '新选项', value: generateId() }
  if (!parent) {
    const opts = [...getCascaderOptions(), newOpt]
    const config = { ...(field.value.config || {}), cascaderOptions: opts }
    updateField({ config })
  } else {
    const opts = JSON.parse(JSON.stringify(getCascaderOptions())) as CascaderOption[]
    const walk = (list: CascaderOption[]): boolean => {
      for (const o of list) {
        if (o.value === parent.value) {
          o.children = o.children || []
          o.children.push(newOpt)
          return true
        }
        if (o.children?.length && walk(o.children)) return true
      }
      return false
    }
    walk(opts)
    const config = { ...(field.value.config || {}), cascaderOptions: opts }
    updateField({ config })
  }
}

function updateCascaderOption(target: CascaderOption, key: 'label' | 'value', val: string) {
  if (!field.value) return
  const opts = JSON.parse(JSON.stringify(getCascaderOptions())) as CascaderOption[]
  const walk = (list: CascaderOption[]): boolean => {
    for (const o of list) {
      if (o.value === target.value) {
        o[key] = val
        return true
      }
      if (o.children?.length && walk(o.children)) return true
    }
    return false
  }
  walk(opts)
  const config = { ...(field.value.config || {}), cascaderOptions: opts }
  updateField({ config })
}

function removeCascaderOption(target: CascaderOption) {
  if (!field.value) return
  const opts = JSON.parse(JSON.stringify(getCascaderOptions())) as CascaderOption[]
  const remove = (list: CascaderOption[]): boolean => {
    const idx = list.findIndex(o => o.value === target.value)
    if (idx > -1) {
      list.splice(idx, 1)
      return true
    }
    for (const o of list) {
      if (o.children?.length && remove(o.children)) return true
    }
    return false
  }
  remove(opts)
  const config = { ...(field.value.config || {}), cascaderOptions: opts }
  updateField({ config })
}

function getLinkageRules(): LinkageRule[] {
  return field.value?.linkages || []
}

function toggleRuleExpand(ruleId: string) {
  if (expandedRules.value.has(ruleId)) {
    expandedRules.value.delete(ruleId)
  } else {
    expandedRules.value.add(ruleId)
  }
}

function addLinkageRule() {
  if (!field.value) return
  const rules = [...getLinkageRules()]
  const newRule: LinkageRule = {
    id: generateId(),
    enabled: true,
    logic: 'AND',
    conditions: [{ fieldId: '', operator: 'eq', value: '' }],
    actions: [{ type: 'show', target: fieldId.value || '' }]
  }
  rules.push(newRule)
  updateField({ linkages: rules })
  if (newRule.id) {
    expandedRules.value.add(newRule.id)
  }
}

function updateLinkageRule(ruleId: string, patch: Partial<LinkageRule>) {
  if (!field.value) return
  const rules = getLinkageRules().map(r => (r.id === ruleId ? { ...r, ...patch } : r))
  updateField({ linkages: rules })
}

function removeLinkageRule(ruleId: string) {
  if (!field.value) return
  const rules = getLinkageRules().filter(r => r.id !== ruleId)
  updateField({ linkages: rules })
  expandedRules.value.delete(ruleId)
}

function addCondition(ruleId: string) {
  if (!field.value) return
  const rules = getLinkageRules().map((r): LinkageRule => {
    if (r.id === ruleId) {
      const cond: LinkageCondition = { fieldId: '', operator: 'eq', value: '' }
      return {
        ...r,
        conditions: [...(r.conditions || []), cond]
      }
    }
    return r
  })
  updateField({ linkages: rules })
}

function updateCondition(ruleId: string, condIndex: number, patch: Partial<LinkageCondition>) {
  if (!field.value) return
  const rules = getLinkageRules().map(r => {
    if (r.id === ruleId && r.conditions) {
      const conditions = [...r.conditions]
      conditions[condIndex] = { ...conditions[condIndex], ...patch }
      return { ...r, conditions }
    }
    return r
  })
  updateField({ linkages: rules })
}

function removeCondition(ruleId: string, condIndex: number) {
  if (!field.value) return
  const rules = getLinkageRules().map(r => {
    if (r.id === ruleId && r.conditions) {
      return {
        ...r,
        conditions: r.conditions.filter((_, i) => i !== condIndex)
      }
    }
    return r
  })
  updateField({ linkages: rules })
}

function addAction(ruleId: string) {
  if (!field.value) return
  const rules = getLinkageRules().map((r): LinkageRule => {
    if (r.id === ruleId) {
      const act: LinkageAction = { type: 'show', target: fieldId.value || '' }
      return {
        ...r,
        actions: [...(r.actions || []), act]
      }
    }
    return r
  })
  updateField({ linkages: rules })
}

function updateAction(ruleId: string, actionIndex: number, patch: Partial<LinkageAction>) {
  if (!field.value) return
  const rules = getLinkageRules().map((r): LinkageRule => {
    if (r.id === ruleId && r.actions) {
      const actions = [...r.actions]
      actions[actionIndex] = { ...actions[actionIndex], ...patch }
      return { ...r, actions }
    }
    return r
  })
  updateField({ linkages: rules })
}

function removeAction(ruleId: string, actionIndex: number) {
  if (!field.value) return
  const rules = getLinkageRules().map(r => {
    if (r.id === ruleId && r.actions) {
      return {
        ...r,
        actions: r.actions.filter((_, i) => i !== actionIndex)
      }
    }
    return r
  })
  updateField({ linkages: rules })
}

const operatorOptions: { value: LinkageOperator; label: string }[] = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
  { value: 'contains', label: '包含' },
  { value: 'in', label: '在其中' },
  { value: 'empty', label: '为空' },
  { value: 'notempty', label: '不为空' }
]

const actionTypeOptions: { value: LinkageActionType; label: string }[] = [
  { value: 'show', label: '显示' },
  { value: 'hide', label: '隐藏' },
  { value: 'enable', label: '启用' },
  { value: 'disable', label: '禁用' },
  { value: 'setRequired', label: '设为必填' },
  { value: 'setOptional', label: '设为选填' },
  { value: 'setValue', label: '设置值' }
]

const validationRuleOptions: { type: ValidationRuleType; label: string; needsValue: boolean }[] = [
  { type: 'required', label: '必填', needsValue: false },
  { type: 'minLength', label: '最小长度', needsValue: true },
  { type: 'maxLength', label: '最大长度', needsValue: true },
  { type: 'min', label: '最小值', needsValue: true },
  { type: 'max', label: '最大值', needsValue: true },
  { type: 'pattern', label: '正则表达式', needsValue: true },
  { type: 'email', label: '邮箱格式', needsValue: false },
  { type: 'phone', label: '手机号格式', needsValue: false },
  { type: 'url', label: 'URL格式', needsValue: false }
]

const textFieldTypes: FieldType[] = ['input', 'textarea', 'richtext']
const optionFieldTypes: FieldType[] = ['select', 'radio', 'checkbox']

function isTextField(f: SchemaField): boolean {
  return textFieldTypes.includes(f.type)
}

function isOptionField(f: SchemaField): boolean {
  return optionFieldTypes.includes(f.type)
}

function isDateField(f: SchemaField): boolean {
  return f.type === 'date'
}

function isUploadField(f: SchemaField): boolean {
  return f.type === 'upload'
}

function isRatingField(f: SchemaField): boolean {
  return f.type === 'rating'
}

function isRichtextField(f: SchemaField): boolean {
  return f.type === 'richtext'
}

function isCascaderField(f: SchemaField): boolean {
  return f.type === 'cascader'
}

function isGroupField(f: SchemaField): boolean {
  return f.type === 'group'
}

function handleDelete() {
  if (!fieldId.value) return
  if (confirm(`确定删除字段 "${field.value?.label}" 吗？`)) {
    store.removeField(fieldId.value)
  }
}

function getColumnSpan(): number {
  return (field.value?.columnSpan as number) || 1
}

function getFormat(): string {
  const config = field.value?.config as Record<string, unknown> | undefined
  return (config?.format as string) || (field.value?.type === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss')
}

function setFormat(val: string) {
  const config = { ...(field.value?.config || {}), format: val }
  updateField({ config })
}

function getConfigValue<T = unknown>(key: string, defaultValue?: T): T {
  const config = field.value?.config as Record<string, unknown> | undefined
  return (config?.[key] as T) ?? (defaultValue as T)
}

function setConfigValue(key: string, value: unknown) {
  const config = { ...(field.value?.config || {}), [key]: value }
  updateField({ config })
}

function getGroupCollapsed(): boolean {
  return getConfigValue('collapsed', false)
}

function setGroupCollapsed(val: boolean) {
  setConfigValue('collapsed', val)
}

function getGroupPageBreak(): boolean {
  return getConfigValue('pageBreak', false)
}

function setGroupPageBreak(val: boolean) {
  setConfigValue('pageBreak', val)
}

function getRatingMax(): number {
  return getConfigValue('max', 5)
}

function setRatingMax(val: number) {
  setConfigValue('max', val)
}

function getRatingAllowHalf(): boolean {
  return getConfigValue('allowHalf', false)
}

function setRatingAllowHalf(val: boolean) {
  setConfigValue('allowHalf', val)
}

function getUploadAccept(): string {
  return getConfigValue('accept', '')
}

function setUploadAccept(val: string) {
  setConfigValue('accept', val)
}

function getUploadMaxSize(): number {
  return getConfigValue('maxSize', 10)
}

function setUploadMaxSize(val: number) {
  setConfigValue('maxSize', val)
}

function getUploadMultiple(): boolean {
  return getConfigValue('multiple', false)
}

function setUploadMultiple(val: boolean) {
  setConfigValue('multiple', val)
}

function getSelectMultiple(): boolean {
  return getConfigValue('multiple', false)
}

function setSelectMultiple(val: boolean) {
  setConfigValue('multiple', val)
}

function getOptionInline(): boolean {
  return getConfigValue('inline', false)
}

function setOptionInline(val: boolean) {
  setConfigValue('inline', val)
}

function getNumberConfig(key: 'min' | 'max' | 'step', defaultValue: number): number {
  return getConfigValue(key, defaultValue)
}

function setNumberConfig(key: 'min' | 'max' | 'step', val: number) {
  setConfigValue(key, val)
}

function getPlaceholder(): string {
  return getConfigValue('placeholder', '')
}

function setPlaceholder(val: string) {
  setConfigValue('placeholder', val)
}


</script>

<template>
  <aside class="property-panel">
    <div class="panel-header">
      <component :is="activeTab === 'properties' ? Settings : GitBranch" :size="18" class="panel-header-icon" />
      <span v-if="field">{{ field.label }} 的配置</span>
      <span v-else>属性配置</span>
    </div>

    <div v-if="field" class="panel-tabs">
      <button
        :class="['panel-tab', { active: activeTab === 'properties' }]"
        @click="activeTab = 'properties'"
      >
        <Settings :size="14" />
        属性配置
      </button>
      <button
        :class="['panel-tab', { active: activeTab === 'linkage' }]"
        @click="activeTab = 'linkage'"
      >
        <GitBranch :size="14" />
        联动规则
      </button>
    </div>

    <div class="panel-body">
      <div v-if="!field" class="panel-empty">
        <Type :size="48" class="empty-icon" />
        <p>请选择一个字段</p>
        <span>点击画布中的字段可进行编辑</span>
      </div>

      <template v-else-if="activeTab === 'properties'">
        <div class="prop-section">
          <div class="prop-section-title">基础属性</div>

          <div class="prop-item">
            <label class="prop-label">字段标签</label>
            <input
              type="text"
              class="prop-input"
              :value="field.label"
              @input="(e) => updateField({ label: (e.target as HTMLInputElement).value })"
              placeholder="请输入字段标签"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">字段名称</label>
            <input
              type="text"
              class="prop-input"
              :value="field.name || field.field"
              @input="(e) => { const v = (e.target as HTMLInputElement).value; updateField({ name: v, field: v }); }"
              placeholder="请输入字段名称"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">占位提示</label>
            <input
              type="text"
              class="prop-input"
              :value="getPlaceholder()"
              @input="(e) => setPlaceholder((e.target as HTMLInputElement).value)"
              placeholder="请输入占位提示"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">默认值</label>
            <input
              type="text"
              class="prop-input"
              :value="field.defaultValue ?? ''"
              @input="(e) => updateField({ defaultValue: (e.target as HTMLInputElement).value })"
              placeholder="请输入默认值"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">帮助文字</label>
            <input
              type="text"
              class="prop-input"
              :value="field.helpText || ''"
              @input="(e) => { const v = (e.target as HTMLInputElement).value; updateField({ helpText: v, hint: v }); }"
              placeholder="请输入帮助文字"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">列宽占比</label>
            <select
              class="prop-select"
              :value="getColumnSpan()"
              @change="(e) => updateField({ columnSpan: Number((e.target as HTMLSelectElement).value) })"
            >
              <option v-for="n in 12" :key="n" :value="n">{{ n }} 列</option>
            </select>
          </div>

          <div class="prop-switch-row">
            <span class="prop-label">是否必填</span>
            <div
              :class="['prop-switch', { active: isRequired() }]"
              @click="toggleRequired"
            />
          </div>
        </div>

        <div v-if="field.type === 'number' || field.type === 'slider'" class="prop-section">
          <div class="prop-section-title">数字配置</div>

          <div class="prop-item">
            <label class="prop-label">最小值</label>
            <input
              type="number"
              class="prop-input"
              :value="getNumberConfig('min', field.type === 'slider' ? 0 : 0)"
              @input="(e) => setNumberConfig('min', Number((e.target as HTMLInputElement).value))"
              placeholder="最小值"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">最大值</label>
            <input
              type="number"
              class="prop-input"
              :value="getNumberConfig('max', field.type === 'slider' ? 100 : 1000000)"
              @input="(e) => setNumberConfig('max', Number((e.target as HTMLInputElement).value))"
              placeholder="最大值"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">步长</label>
            <input
              type="number"
              class="prop-input"
              :value="getNumberConfig('step', 1)"
              @input="(e) => setNumberConfig('step', Number((e.target as HTMLInputElement).value))"
              placeholder="步长"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div v-if="isTextField(field)" class="prop-section">
          <div class="prop-section-title">文本配置</div>

          <div class="prop-item">
            <label class="prop-label">最小长度</label>
            <input
              type="number"
              class="prop-input"
              :value="getValidationRule('minLength')?.value ?? ''"
              @input="(e) => {
                const v = (e.target as HTMLInputElement).value
                if (v === '' || v === null || v === undefined) return
                if (!hasValidationRule('minLength')) {
                  toggleValidationRule('minLength')
                }
                updateValidationRuleValue('minLength', Number(v))
              }"
              placeholder="最小字符数"
              min="0"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">最大长度</label>
            <input
              type="number"
              class="prop-input"
              :value="getValidationRule('maxLength')?.value ?? ''"
              @input="(e) => {
                const v = (e.target as HTMLInputElement).value
                if (v === '' || v === null || v === undefined) return
                if (!hasValidationRule('maxLength')) {
                  toggleValidationRule('maxLength')
                }
                updateValidationRuleValue('maxLength', Number(v))
              }"
              placeholder="最大字符数"
              min="0"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">正则验证</label>
            <input
              type="text"
              class="prop-input"
              :value="getValidationRule('pattern')?.value ?? ''"
              @input="(e) => {
                const v = (e.target as HTMLInputElement).value
                if (v && !hasValidationRule('pattern')) {
                  toggleValidationRule('pattern')
                }
                updateValidationRuleValue('pattern', v)
              }"
              placeholder="如: ^[a-zA-Z]+$"
            />
          </div>
        </div>

        <div v-if="isOptionField(field)" class="prop-section">
          <div class="prop-section-title">选项配置</div>

          <div v-if="field.type === 'select'" class="prop-switch-row">
            <span class="prop-label">多选模式</span>
            <div
              :class="['prop-switch', { active: getSelectMultiple() }]"
              @click="setSelectMultiple(!getSelectMultiple())"
            />
          </div>

          <div v-if="field.type === 'radio' || field.type === 'checkbox'" class="prop-switch-row">
            <span class="prop-label">内联排列</span>
            <div
              :class="['prop-switch', { active: getOptionInline() }]"
              @click="setOptionInline(!getOptionInline())"
            />
          </div>

          <div class="option-list">
            <div
              v-for="(opt, idx) in getOptions()"
              :key="idx"
              class="option-row"
            >
              <input
                type="text"
                class="prop-input"
                :value="opt.label"
                @input="(e) => updateOption(idx, 'label', (e.target as HTMLInputElement).value)"
                placeholder="标签"
              />
              <input
                type="text"
                class="prop-input"
                :value="opt.value"
                @input="(e) => updateOption(idx, 'value', (e.target as HTMLInputElement).value)"
                placeholder="值"
              />
              <button class="btn-icon btn-danger-icon" @click="removeOption(idx)">
                <X :size="14" />
              </button>
            </div>
            <button class="btn btn-outline btn-sm btn-block" @click="addOption">
              <Plus :size="14" />
              添加选项
            </button>
          </div>
        </div>

        <div v-if="isDateField(field) || field.type === 'time'" class="prop-section">
          <div class="prop-section-title">日期/时间配置</div>

          <div class="prop-item">
            <label class="prop-label">格式</label>
            <select
              class="prop-select"
              :value="getFormat()"
              @change="(e) => setFormat((e.target as HTMLSelectElement).value)"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
              <option value="HH:mm:ss">HH:mm:ss</option>
            </select>
          </div>
        </div>

        <div v-if="isUploadField(field)" class="prop-section">
          <div class="prop-section-title">上传配置</div>

          <div class="prop-item">
            <label class="prop-label">接受类型</label>
            <input
              type="text"
              class="prop-input"
              :value="getUploadAccept()"
              @input="(e) => setUploadAccept((e.target as HTMLInputElement).value)"
              placeholder="如: image/*,.pdf"
            />
          </div>

          <div class="prop-item">
            <label class="prop-label">最大大小 (MB)</label>
            <input
              type="number"
              class="prop-input"
              :value="getUploadMaxSize()"
              @input="(e) => setUploadMaxSize(Number((e.target as HTMLInputElement).value))"
              placeholder="如: 10"
              min="0"
            />
          </div>

          <div class="prop-switch-row">
            <span class="prop-label">多文件上传</span>
            <div
              :class="['prop-switch', { active: getUploadMultiple() }]"
              @click="setUploadMultiple(!getUploadMultiple())"
            />
          </div>
        </div>

        <div v-if="isRatingField(field)" class="prop-section">
          <div class="prop-section-title">评分配置</div>

          <div class="prop-item">
            <label class="prop-label">最大星星数</label>
            <input
              type="number"
              class="prop-input"
              :value="getRatingMax()"
              @input="(e) => setRatingMax(Number((e.target as HTMLInputElement).value))"
              min="1"
              max="10"
            />
          </div>

          <div class="prop-switch-row">
            <span class="prop-label">允许半星</span>
            <div
              :class="['prop-switch', { active: getRatingAllowHalf() }]"
              @click="setRatingAllowHalf(!getRatingAllowHalf())"
            />
          </div>
        </div>

        <div v-if="isRichtextField(field)" class="prop-section">
          <div class="prop-section-title">富文本配置</div>
          <div class="prop-item">
            <label class="prop-label">工具栏</label>
            <div class="toolbar-grid">
              <label
                v-for="opt in toolbarOptions"
                :key="opt.key"
                class="toolbar-checkbox"
              >
                <input
                  type="checkbox"
                  :checked="getToolbar().includes(opt.key)"
                  @change="() => toggleToolbar(opt.key)"
                />
                <span>{{ opt.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="isCascaderField(field)" class="prop-section">
          <div class="prop-section-title">级联配置</div>

          <div class="cascader-list">
            <template v-for="opt in getCascaderOptions()" :key="opt.value">
              <div class="cascader-item">
                <div class="cascader-item-row">
                  <input
                    type="text"
                    class="prop-input"
                    :value="opt.label"
                    @input="(e) => updateCascaderOption(opt, 'label', (e.target as HTMLInputElement).value)"
                    placeholder="标签"
                  />
                  <input
                    type="text"
                    class="prop-input"
                    :value="opt.value"
                    @input="(e) => updateCascaderOption(opt, 'value', (e.target as HTMLInputElement).value)"
                    placeholder="值"
                  />
                  <button class="btn-icon" @click="addCascaderOption(opt)" title="添加子项">
                    <Plus :size="14" />
                  </button>
                  <button class="btn-icon btn-danger-icon" @click="removeCascaderOption(opt)" title="删除">
                    <X :size="14" />
                  </button>
                </div>
                <div v-if="opt.children?.length" class="cascader-children">
                  <template v-for="child1 in opt.children" :key="child1.value">
                    <div class="cascader-item">
                      <div class="cascader-item-row">
                        <input
                          type="text"
                          class="prop-input"
                          :value="child1.label"
                          @input="(e) => updateCascaderOption(child1, 'label', (e.target as HTMLInputElement).value)"
                          placeholder="标签"
                        />
                        <input
                          type="text"
                          class="prop-input"
                          :value="child1.value"
                          @input="(e) => updateCascaderOption(child1, 'value', (e.target as HTMLInputElement).value)"
                          placeholder="值"
                        />
                        <button class="btn-icon" @click="addCascaderOption(child1)" title="添加子项">
                          <Plus :size="14" />
                        </button>
                        <button class="btn-icon btn-danger-icon" @click="removeCascaderOption(child1)" title="删除">
                          <X :size="14" />
                        </button>
                      </div>
                      <div v-if="child1.children?.length" class="cascader-children">
                        <template v-for="child2 in child1.children" :key="child2.value">
                          <div class="cascader-item">
                            <div class="cascader-item-row">
                              <input
                                type="text"
                                class="prop-input"
                                :value="child2.label"
                                @input="(e) => updateCascaderOption(child2, 'label', (e.target as HTMLInputElement).value)"
                                placeholder="标签"
                              />
                              <input
                                type="text"
                                class="prop-input"
                                :value="child2.value"
                                @input="(e) => updateCascaderOption(child2, 'value', (e.target as HTMLInputElement).value)"
                                placeholder="值"
                              />
                              <button class="btn-icon btn-danger-icon" @click="removeCascaderOption(child2)" title="删除">
                                <X :size="14" />
                              </button>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>
            <button class="btn btn-outline btn-sm btn-block" @click="() => addCascaderOption()">
              <Plus :size="14" />
              添加一级选项
            </button>
          </div>
        </div>

        <div v-if="isGroupField(field)" class="prop-section">
          <div class="prop-section-title">分组配置</div>

          <div class="prop-switch-row">
            <span class="prop-label">默认折叠</span>
            <div
              :class="['prop-switch', { active: getGroupCollapsed() }]"
              @click="setGroupCollapsed(!getGroupCollapsed())"
            />
          </div>

          <div class="prop-switch-row">
            <span class="prop-label">分页显示</span>
            <div
              :class="['prop-switch', { active: getGroupPageBreak() }]"
              @click="setGroupPageBreak(!getGroupPageBreak())"
            />
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-title">校验规则</div>
          <div class="validation-list">
            <div
              v-for="ruleOpt in validationRuleOptions"
              :key="ruleOpt.type"
              :class="['validation-item', { active: hasValidationRule(ruleOpt.type) }]"
            >
              <div class="validation-header">
                <label class="validation-checkbox">
                  <input
                    type="checkbox"
                    :checked="hasValidationRule(ruleOpt.type)"
                    @change="() => toggleValidationRule(ruleOpt.type)"
                  />
                  <span>{{ ruleOpt.label }}</span>
                </label>
              </div>
              <div v-if="hasValidationRule(ruleOpt.type)" class="validation-body">
                <div v-if="ruleOpt.needsValue" class="prop-item">
                  <label class="prop-label">规则值</label>
                  <input
                    type="text"
                    class="prop-input"
                    :value="getValidationRule(ruleOpt.type)?.value ?? ''"
                    @input="(e) => updateValidationRuleValue(ruleOpt.type, (e.target as HTMLInputElement).value)"
                    :placeholder="`请输入${ruleOpt.label}`"
                  />
                </div>
                <div class="prop-item">
                  <label class="prop-label">错误提示</label>
                  <input
                    type="text"
                    class="prop-input"
                    :value="getValidationRule(ruleOpt.type)?.message ?? ''"
                    @input="(e) => updateValidationRuleMessage(ruleOpt.type, (e.target as HTMLInputElement).value)"
                    placeholder="自定义错误消息"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="prop-section">
          <button class="btn btn-danger btn-block" @click="handleDelete">
            <Trash2 :size="16" />
            删除字段
          </button>
        </div>
      </template>

      <template v-else-if="activeTab === 'linkage'">
        <div class="linkage-header">
          <span class="prop-section-title">联动规则</span>
          <button class="btn btn-primary btn-sm" @click="addLinkageRule">
            <Plus :size="14" />
            添加规则
          </button>
        </div>

        <div v-if="getLinkageRules().length === 0" class="panel-empty">
          <GitBranch :size="48" class="empty-icon" />
          <p>暂无联动规则</p>
          <span>点击上方按钮添加第一条规则</span>
        </div>

        <div v-else class="linkage-list">
          <div
            v-for="rule in getLinkageRules()"
            :key="rule.id"
            :class="['linkage-card', { collapsed: !expandedRules.has(rule.id!) }]"
          >
            <div class="linkage-card-header" @click="toggleRuleExpand(rule.id!)">
              <div class="linkage-card-title">
                <span>规则 {{ getLinkageRules().indexOf(rule) + 1 }}</span>
                <span v-if="!rule.enabled" class="linkage-disabled">(已禁用)</span>
              </div>
              <div class="linkage-card-actions" @click.stop>
                <div
                  :class="['prop-switch', { active: rule.enabled }]"
                  style="width: 36px; height: 20px; min-width: 36px;"
                  @click="updateLinkageRule(rule.id!, { enabled: !rule.enabled })"
                />
                <button class="btn-icon btn-danger-icon" @click="removeLinkageRule(rule.id!)">
                  <X :size="14" />
                </button>
              </div>
            </div>

            <div v-if="expandedRules.has(rule.id!)" class="linkage-card-body">
              <div class="prop-item">
                <label class="prop-label">条件逻辑</label>
                <select
                      class="prop-select"
                      :value="(rule.logic || 'AND').toUpperCase()"
                      @change="(e) => updateLinkageRule(rule.id!, { logic: (e.target as HTMLSelectElement).value.toLowerCase() as 'and' | 'or' })"
                    >
                      <option value="AND">全部满足 (AND)</option>
                      <option value="OR">任一满足 (OR)</option>
                    </select>
              </div>

              <div class="prop-item">
                <div class="prop-label-row">
                  <span class="prop-label">触发条件</span>
                  <button class="btn btn-sm btn-outline" @click="addCondition(rule.id!)">
                    <Plus :size="12" />
                    添加
                  </button>
                </div>
                <div class="condition-list">
                  <div
                    v-for="(cond, condIdx) in rule.conditions"
                    :key="condIdx"
                    class="condition-row"
                  >
                    <select
                      class="prop-select"
                      :value="cond.fieldId"
                      @change="(e) => updateCondition(rule.id!, condIdx, { fieldId: (e.target as HTMLSelectElement).value })"
                    >
                      <option value="">选择字段</option>
                      <option v-for="f in allFields" :key="f.id" :value="f.id">
                        {{ f.label }}
                      </option>
                    </select>
                    <select
                      class="prop-select"
                      :value="cond.operator"
                      @change="(e) => updateCondition(rule.id!, condIdx, { operator: (e.target as HTMLSelectElement).value as LinkageOperator })"
                    >
                      <option
                        v-for="op in operatorOptions"
                        :key="op.value"
                        :value="op.value"
                      >
                        {{ op.label }}
                      </option>
                    </select>
                    <input
                      v-if="cond.operator !== 'empty' && cond.operator !== 'notempty'"
                      type="text"
                      class="prop-input"
                      :value="cond.value ?? ''"
                      @input="(e) => updateCondition(rule.id!, condIdx, { value: (e.target as HTMLInputElement).value })"
                      placeholder="值"
                    />
                    <button
                      v-if="(rule.conditions?.length || 0) > 1"
                      class="btn-icon btn-danger-icon"
                      @click="removeCondition(rule.id!, condIdx)"
                    >
                      <X :size="14" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="prop-item">
                <div class="prop-label-row">
                  <span class="prop-label">执行动作</span>
                  <button class="btn btn-sm btn-outline" @click="addAction(rule.id!)">
                    <Plus :size="12" />
                    添加
                  </button>
                </div>
                <div class="action-list">
                  <div
                    v-for="(action, actionIdx) in rule.actions"
                    :key="actionIdx"
                    class="action-row"
                  >
                    <select
                      class="prop-select"
                      :value="action.type"
                      @change="(e) => updateAction(rule.id!, actionIdx, { type: (e.target as HTMLSelectElement).value as LinkageActionType })"
                    >
                      <option
                        v-for="act in actionTypeOptions"
                        :key="act.value"
                        :value="act.value"
                      >
                        {{ act.label }}
                      </option>
                    </select>
                    <select
                      class="prop-select"
                      :value="action.target"
                      @change="(e) => updateAction(rule.id!, actionIdx, { target: (e.target as HTMLSelectElement).value })"
                    >
                      <option value="">选择目标字段</option>
                      <option v-for="f in allFields" :key="f.id" :value="f.id">
                        {{ f.label }}
                      </option>
                    </select>
                    <input
                      v-if="action.type === 'setValue'"
                      type="text"
                      class="prop-input"
                      :value="action.value ?? ''"
                      @input="(e) => updateAction(rule.id!, actionIdx, { value: (e.target as HTMLInputElement).value })"
                      placeholder="值"
                    />
                    <button
                      v-if="(rule.actions?.length || 0) > 1"
                      class="btn-icon btn-danger-icon"
                      @click="removeAction(rule.id!, actionIdx)"
                    >
                      <X :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-left: 1px solid #e8e8e8;
  box-sizing: border-box;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #e8e8e8;
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  flex-shrink: 0;
}

.panel-header-icon {
  color: #1677ff;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.panel-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.panel-tab:hover {
  color: #1f1f1f;
  background: #fafafa;
}

.panel-tab.active {
  color: #1677ff;
  border-bottom-color: #1677ff;
  background: #e6f4ff;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  text-align: center;
  color: #999;
}

.empty-icon {
  color: #d9d9d9;
}

.panel-empty p {
  font-size: 14px;
  font-weight: 500;
  color: #666;
  margin: 0;
}

.panel-empty span {
  font-size: 12px;
  color: #999;
}

.prop-section {
  margin-bottom: 20px;
}

.prop-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #1677ff;
}

.prop-item {
  margin-bottom: 12px;
}

.prop-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  margin-bottom: 6px;
}

.prop-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.prop-input,
.prop-select {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  color: #1f1f1f;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  box-sizing: border-box;
  transition: all 0.2s ease;
  outline: none;
}

.prop-input:hover,
.prop-select:hover {
  border-color: #4096ff;
}

.prop-input:focus,
.prop-select:focus {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.prop-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 4px 0;
}

.prop-switch-row .prop-label {
  margin-bottom: 0;
}

.prop-switch {
  position: relative;
  width: 44px;
  height: 22px;
  min-width: 44px;
  background: #d9d9d9;
  border-radius: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 2px;
  box-sizing: border-box;
}

.prop-switch::after {
  content: '';
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.prop-switch.active {
  background: #1677ff;
}

.prop-switch.active::after {
  transform: translateX(22px);
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.option-row .prop-input {
  flex: 1;
  min-width: 0;
}

.cascader-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cascader-item {
  margin-bottom: 6px;
}

.cascader-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cascader-item-row .prop-input {
  flex: 1;
  min-width: 0;
}

.cascader-children {
  margin-left: 20px;
  padding-left: 8px;
  border-left: 2px solid #e8e8e8;
  margin-top: 6px;
}

.btn,
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  box-sizing: border-box;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

.btn-block {
  width: 100%;
}

.btn-primary {
  background: #1677ff;
  color: #fff;
}

.btn-primary:hover {
  background: #4096ff;
}

.btn-outline {
  background: #fff;
  color: #1677ff;
  border: 1px solid #1677ff;
}

.btn-outline:hover {
  background: #e6f4ff;
}

.btn-danger {
  background: #ff4d4f;
  color: #fff;
}

.btn-danger:hover {
  background: #ff7875;
}

.btn-icon {
  padding: 5px;
  width: 28px;
  height: 28px;
  background: #f5f5f5;
  color: #666;
  border-radius: 4px;
}

.btn-icon:hover {
  background: #e8e8e8;
}

.btn-danger-icon {
  color: #ff4d4f;
}

.btn-danger-icon:hover {
  background: #fff1f0;
}

.toolbar-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.toolbar-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.toolbar-checkbox input {
  width: 14px;
  height: 14px;
  accent-color: #1677ff;
  cursor: pointer;
}

.validation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.validation-item {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.validation-item.active {
  border-color: #1677ff;
  background: #e6f4ff;
}

.validation-header {
  padding: 8px 12px;
  background: #fafafa;
}

.validation-item.active .validation-header {
  background: rgba(22, 119, 255, 0.08);
}

.validation-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.validation-checkbox input {
  width: 14px;
  height: 14px;
  accent-color: #1677ff;
  cursor: pointer;
}

.validation-body {
  padding: 10px 12px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
}

.linkage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.linkage-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.linkage-card {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.linkage-card:hover {
  border-color: #1677ff;
}

.linkage-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fafafa;
  cursor: pointer;
  transition: background 0.2s ease;
}

.linkage-card-header:hover {
  background: #f5f5f5;
}

.linkage-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #1f1f1f;
}

.linkage-disabled {
  font-size: 12px;
  color: #999;
  font-weight: normal;
}

.linkage-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.linkage-card-body {
  padding: 12px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
}

.condition-list,
.action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.condition-row,
.action-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.condition-row .prop-select,
.action-row .prop-select,
.condition-row .prop-input,
.action-row .prop-input {
  flex: 1;
  min-width: 0;
}
</style>
