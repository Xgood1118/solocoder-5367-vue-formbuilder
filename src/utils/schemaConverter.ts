import type {
  FormSchema,
  SchemaField,
  ExportedJSONSchema,
  FormMeta,
  LinkageRule,
  LinkageCondition,
  LinkageAction,
  ValidationRule,
  FieldOption,
  CascaderOption,
  FieldType,
  FormStatus,
  JSONSchemaProperty
} from '@/types'

export const CURRENT_VERSION = '1.2.0'

export const defaultCascaderOptions: CascaderOption[] = [
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
]

const LABEL_MAP: Record<FieldType, string> = {
  input: '文本输入',
  number: '数字输入',
  textarea: '多行文本',
  select: '下拉选择',
  radio: '单选框',
  checkbox: '多选框',
  slider: '滑块',
  switch: '开关',
  date: '日期选择',
  time: '时间选择',
  rating: '评分',
  upload: '文件上传',
  cascader: '级联选择',
  richtext: '富文本',
  group: '分组'
}

const PREFIX_MAP: Record<FieldType, string> = {
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

function collectFieldNames(fields: SchemaField[]): Set<string> {
  const names = new Set<string>()
  const walk = (list: SchemaField[]) => {
    for (const f of list) {
      if (f.name) names.add(f.name)
      if (f.field) names.add(f.field)
      if (f.type === 'group' && f.children?.length) {
        walk(f.children)
      }
    }
  }
  walk(fields)
  return names
}

function generateUniqueName(type: FieldType, existingNames: Set<string>): string {
  const prefix = PREFIX_MAP[type] || 'field'
  let counter = 1
  let name = ''
  do {
    name = `${prefix}_${counter}`
    counter++
  } while (existingNames.has(name))
  return name
}

export function createDefaultField(type: FieldType, existingFields: SchemaField[] = []): SchemaField {
  const id = generateId()
  const names = collectFieldNames(existingFields)
  const name = generateUniqueName(type, names)
  const label = LABEL_MAP[type]
  const defaultOptions: FieldOption[] = [
    { label: '选项1', value: 'opt1' },
    { label: '选项2', value: 'opt2' },
    { label: '选项3', value: 'opt3' }
  ]

  const base: SchemaField = {
    id,
    type,
    label,
    name,
    field: name,
    placeholder: type === 'group' ? '' : `请输入${label}`,
    helpText: '',
    defaultValue: undefined,
    options: undefined,
    cascaderOptions: undefined,
    config: { required: false },
    validation: [],
    linkages: [],
    inline: false,
    maxRate: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
    accept: undefined,
    multiple: false,
    collapsed: false,
    fields: undefined,
    children: undefined,
    columnSpan: 1
  }

  switch (type) {
    case 'input':
      base.defaultValue = ''
      base.placeholder = `请输入${label}`
      break
    case 'number':
      base.defaultValue = 0
      base.min = 0
      base.max = 1000000
      base.step = 1
      base.placeholder = `请输入${label}`
      break
    case 'textarea':
      base.defaultValue = ''
      base.placeholder = `请输入${label}`
      break
    case 'select':
      base.defaultValue = null
      base.options = [...defaultOptions]
      base.placeholder = `请选择${label}`
      base.multiple = false
      break
    case 'radio':
      base.defaultValue = null
      base.options = [...defaultOptions]
      base.inline = true
      base.placeholder = `请选择${label}`
      break
    case 'checkbox':
      base.defaultValue = []
      base.options = [...defaultOptions]
      base.inline = true
      base.placeholder = `请选择${label}`
      break
    case 'slider':
      base.defaultValue = 0
      base.min = 0
      base.max = 100
      base.step = 1
      break
    case 'switch':
      base.defaultValue = false
      base.placeholder = ''
      break
    case 'date':
      base.defaultValue = ''
      base.placeholder = `请选择${label}`
      base.config = { required: false, format: 'YYYY-MM-DD' }
      break
    case 'time':
      base.defaultValue = ''
      base.placeholder = `请选择${label}`
      base.config = { required: false, format: 'HH:mm:ss' }
      break
    case 'rating':
      base.defaultValue = 0
      base.maxRate = 5
      base.config = { required: false, max: 5, allowHalf: false }
      break
    case 'upload':
      base.defaultValue = []
      base.multiple = false
      base.config = { required: false, accept: '', maxSize: 10, multiple: false }
      break
    case 'cascader':
      base.defaultValue = []
      base.cascaderOptions = JSON.parse(JSON.stringify(defaultCascaderOptions))
      base.placeholder = '请依次选择'
      break
    case 'richtext':
      base.defaultValue = ''
      base.placeholder = `请输入${label}`
      base.config = {
        required: false,
        toolbar: [
          'bold',
          'italic',
          'underline',
          'strikeThrough',
          'insertUnorderedList',
          'insertOrderedList',
          'justifyLeft',
          'justifyCenter',
          'justifyRight'
        ]
      }
      break
    case 'group':
      base.defaultValue = undefined
      base.collapsed = false
      base.children = []
      base.config = { required: false, collapsed: false, pageBreak: false }
      break
  }

  return base
}

export function generateId(): string {
  const bytes = new Uint8Array(4)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 4; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createEmptySchema(name = '未命名表单'): FormSchema {
  const now = new Date().toISOString()
  return {
    meta: {
      id: generateId(),
      name,
      tenantId: 'default',
      status: 'idle' as FormStatus,
      version: CURRENT_VERSION,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          timestamp: now,
          action: 'create',
          operator: 'system'
        }
      ]
    },
    fields: [],
    linkageRules: [],
    config: {},
    validation: []
  }
}

export function persistToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('[schemaConverter] persistToStorage failed:', e)
    throw e
  }
}

export function loadFromStorage(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.error('[schemaConverter] loadFromStorage failed:', e)
    return null
  }
}

function getFieldName(field: SchemaField): string {
  return field.name || field.field || ''
}

function getFieldChildren(field: SchemaField): SchemaField[] | undefined {
  return field.fields || field.children
}

function isFieldRequired(field: SchemaField): boolean {
  if (field.config?.required) return true
  if (Array.isArray(field.validation)) {
    return field.validation.some((r) => r.type === 'required')
  }
  if (field.rules) {
    if (Array.isArray(field.rules)) {
      return field.rules.some((r) => r.type === 'required')
    }
    if ((field.rules as unknown as Record<string, unknown>).required) return true
  }
  return false
}

function getHelpText(field: SchemaField): string | undefined {
  return field.helpText || field.hint
}

function getValidationRules(field: SchemaField): ValidationRule[] {
  if (Array.isArray(field.validation)) return field.validation
  if (Array.isArray(field.rules)) return field.rules
  return []
}

function flattenFields(fields: SchemaField[]): SchemaField[] {
  const result: SchemaField[] = []
  for (const field of fields) {
    if (field.type === 'group') {
      const children = getFieldChildren(field)
      if (children && children.length > 0) {
        result.push(...flattenFields(children))
      }
    } else {
      result.push(field)
    }
  }
  return result
}

function collectFieldOrder(fields: SchemaField[]): string[] {
  const result: string[] = []
  for (const field of fields) {
    if (field.type === 'group') {
      const children = getFieldChildren(field)
      if (children && children.length > 0) {
        result.push(...collectFieldOrder(children))
      }
    } else {
      const name = getFieldName(field)
      if (name) result.push(name)
    }
  }
  return result
}

function collectGroupNames(fields: SchemaField[]): string[] {
  const result: string[] = []
  for (const field of fields) {
    if (field.type === 'group') {
      const name = getFieldName(field)
      if (name) result.push(name)
      const children = getFieldChildren(field)
      if (children && children.length > 0) {
        result.push(...collectGroupNames(children))
      }
    }
  }
  return result
}

function findValidationRule(
  rules: ValidationRule[],
  type: ValidationRule['type']
): ValidationRule | undefined {
  return rules.find((r) => r.type === type || r.type.toLowerCase() === type.toLowerCase())
}

function buildFieldProperty(field: SchemaField): Record<string, unknown> {
  const prop: Record<string, unknown> = {}

  if (field.label) {
    prop.title = field.label
  }

  const helpText = getHelpText(field)
  if (helpText) {
    prop.description = helpText
  }

  const defaultValue = field.defaultValue ?? field.config?.defaultValue
  if (defaultValue !== undefined) {
    prop.default = defaultValue
  }

  const rules = getValidationRules(field)

  const mapFieldType = (t: FieldType): FieldType => {
    switch (t) {
      case 'input':
        return 'input'
      case 'rating':
        return 'rating'
      default:
        return t
    }
  }

  const effectiveType = mapFieldType(field.type)

  switch (effectiveType) {
    case 'input':
    case 'textarea':
    case 'richtext': {
      prop.type = 'string'
      const minLenRule = findValidationRule(rules, 'minLength') || findValidationRule(rules, 'minlength')
      const maxLenRule = findValidationRule(rules, 'maxLength') || findValidationRule(rules, 'maxlength')
      const patternRule = findValidationRule(rules, 'pattern')
      const emailRule = findValidationRule(rules, 'email')
      const urlRule = findValidationRule(rules, 'url')

      if (minLenRule?.value !== undefined) prop.minLength = Number(minLenRule.value)
      if (maxLenRule?.value !== undefined) prop.maxLength = Number(maxLenRule.value)
      if (patternRule?.value) prop.pattern = String(patternRule.value)
      if (emailRule) prop.format = 'email'
      if (urlRule) prop.format = 'uri'
      break
    }
    case 'number':
    case 'slider':
    case 'rating': {
      prop.type = 'number'
      const minRule = findValidationRule(rules, 'min')
      const maxRule = findValidationRule(rules, 'max')
      const min = field.min !== undefined ? field.min : (minRule?.value !== undefined ? Number(minRule.value) : undefined)
      const max = field.max !== undefined ? field.max : (maxRule?.value !== undefined ? Number(maxRule.value) : undefined)
      if (min !== undefined) prop.minimum = min
      if (max !== undefined) prop.maximum = max
      if (field.step !== undefined) prop.multipleOf = field.step
      if (effectiveType === 'rating' && field.maxRate !== undefined) {
        prop.maximum = field.maxRate
      }
      break
    }
    case 'select':
    case 'radio': {
      const options = field.options || []
      const enumValues = options.map((o: FieldOption) => o.value)
      if (field.multiple) {
        prop.type = 'array'
        prop.items = {
          type: 'string',
          enum: enumValues
        }
        prop.uniqueItems = true
      } else {
        prop.type = 'string'
        if (enumValues.length > 0) prop.enum = enumValues
      }
      break
    }
    case 'checkbox': {
      const options = field.options || []
      const enumValues = options.map((o: FieldOption) => o.value)
      prop.type = 'array'
      prop.items = {
        type: 'string',
        enum: enumValues
      }
      prop.uniqueItems = true
      const minLenRule = findValidationRule(rules, 'minLength') || findValidationRule(rules, 'minlength')
      if (minLenRule?.value !== undefined) prop.minItems = Number(minLenRule.value)
      break
    }
    case 'switch': {
      prop.type = 'boolean'
      break
    }
    case 'date': {
      prop.type = 'string'
      prop.format = 'date'
      break
    }
    case 'time': {
      prop.type = 'string'
      prop.format = 'time'
      break
    }
    case 'cascader': {
      prop.type = 'array'
      const maxLevel = getCascaderMaxLevel(field.cascaderOptions || [])
      const items: Record<string, unknown>[] = []
      for (let i = 0; i < Math.max(3, maxLevel); i++) {
        items.push({ type: 'string' })
      }
      prop.items = items
      prop.minItems = 0
      prop.maxItems = items.length
      break
    }
    case 'upload': {
      prop.type = 'array'
      prop.items = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          size: { type: 'number' },
          type: { type: 'string' },
          url: { type: 'string' }
        },
        required: ['name', 'size', 'type']
      }
      if (!field.multiple) {
        prop.maxItems = 1
      }
      break
    }
    default:
      prop.type = 'string'
      break
  }

  return prop
}

function getCascaderMaxLevel(options: CascaderOption[]): number {
  let maxLevel = 0
  const walk = (opts: CascaderOption[], level: number) => {
    maxLevel = Math.max(maxLevel, level)
    opts.forEach((o) => {
      if (o.children && o.children.length > 0) {
        walk(o.children, level + 1)
      }
    })
  }
  walk(options, 1)
  return maxLevel
}

function getConditionField(cond: LinkageCondition): string {
  return cond.fieldId || (cond as unknown as Record<string, string>).field || ''
}

function normalizeOperator(op: string): string {
  const map: Record<string, string> = {
    '==': 'eq',
    '!=': 'ne',
    '>': 'gt',
    '<': 'lt',
    '>=': 'gte',
    '<=': 'lte',
    notEmpty: 'notempty'
  }
  return map[op] || op
}

function buildConditionJSONSchema(condition: LinkageCondition): Record<string, unknown> {
  const field = getConditionField(condition)
  const operator = normalizeOperator(String(condition.operator))
  const value = condition.value
  const properties: Record<string, unknown> = {}

  switch (operator) {
    case 'eq':
      properties[field] = { const: value }
      break
    case 'ne':
      properties[field] = { not: { const: value } }
      break
    case 'gt':
      properties[field] = { type: 'number', exclusiveMinimum: Number(value) }
      break
    case 'lt':
      properties[field] = { type: 'number', exclusiveMaximum: Number(value) }
      break
    case 'gte':
      properties[field] = { type: 'number', minimum: Number(value) }
      break
    case 'lte':
      properties[field] = { type: 'number', maximum: Number(value) }
      break
    case 'in':
      properties[field] = { enum: Array.isArray(value) ? value : [value] }
      break
    case 'contains':
      if (typeof value === 'string') {
        properties[field] = { type: 'string', pattern: String(value) }
      } else {
        properties[field] = { type: 'array', contains: { const: value } }
      }
      break
    case 'empty':
      properties[field] = {
        anyOf: [
          { type: 'null' },
          { type: 'string', maxLength: 0 },
          { type: 'array', maxItems: 0 }
        ]
      }
      break
    case 'notempty':
      properties[field] = {
        not: {
          anyOf: [
            { type: 'null' },
            { type: 'string', maxLength: 0 },
            { type: 'array', maxItems: 0 }
          ]
        }
      }
      break
    default:
      break
  }

  return { type: 'object', properties, required: [field] }
}

function getRuleLogic(rule: LinkageRule): 'AND' | 'OR' {
  const logic = String(rule.logic || 'AND').toUpperCase()
  return logic === 'OR' ? 'OR' : 'AND'
}

function getRuleAction(rule: LinkageRule): string {
  if (rule.action) return rule.action
  if (rule.actions && rule.actions.length > 0) return rule.actions[0].type
  return 'show'
}

function getRuleActions(rule: LinkageRule): string[] {
  if (rule.actions && rule.actions.length > 0) {
    return rule.actions.map((a) => a.target)
  }
  if (rule.conditions) {
    return rule.conditions.map(getConditionField).filter((v, i, a) => a.indexOf(v) === i)
  }
  return []
}

function buildLinkageAllOf(rules: LinkageRule[]): Array<{
  if: Record<string, unknown>
  then?: Record<string, unknown>
  else?: Record<string, unknown>
}> {
  const allOf: Array<{
    if: Record<string, unknown>
    then?: Record<string, unknown>
    else?: Record<string, unknown>
  }> = []

  for (const rule of rules) {
    const conditions = rule.conditions || []
    if (conditions.length === 0) continue

    let ifSchema: Record<string, unknown>
    if (conditions.length === 1) {
      ifSchema = buildConditionJSONSchema(conditions[0])
    } else {
      const conditionSchemas = conditions.map(buildConditionJSONSchema)
      const logic = getRuleLogic(rule)
      if (logic === 'AND') {
        ifSchema = { allOf: conditionSchemas }
      } else {
        ifSchema = { anyOf: conditionSchemas }
      }
    }

    const item: {
      if: Record<string, unknown>
      then?: Record<string, unknown>
      else?: Record<string, unknown>
    } = { if: ifSchema }

    const targetFields = getRuleActions(rule)
    if (targetFields.length === 0) continue

    const ruleAction = getRuleAction(rule)

    switch (ruleAction) {
      case 'show':
      case 'hide':
      case 'enable':
      case 'disable': {
        break
      }
      case 'setRequired': {
        item.then = { type: 'object', required: targetFields }
        break
      }
      case 'setOptional': {
        item.then = {
          type: 'object',
          not: { required: targetFields }
        }
        break
      }
      default:
        break
    }

    allOf.push(item)
  }

  return allOf
}

function collectAllLinkageRules(fields: SchemaField[], globalRules?: LinkageRule[]): LinkageRule[] {
  const rules: LinkageRule[] = []
  if (globalRules && globalRules.length > 0) {
    rules.push(...globalRules)
  }
  const flatFields = flattenFields(fields)
  for (const field of flatFields) {
    if (field.linkages && field.linkages.length > 0) {
      rules.push(...field.linkages)
    }
  }
  return rules
}

export function formSchemaToJSONSchema(schema: FormSchema): ExportedJSONSchema {
  const flatFields = flattenFields(schema.fields)
  const properties: Record<string, JSONSchemaProperty> = {}
  const required: string[] = []

  for (const field of flatFields) {
    const name = getFieldName(field)
    if (!name) continue
    properties[name] = buildFieldProperty(field) as JSONSchemaProperty
    if (isFieldRequired(field)) {
      required.push(name)
    }
  }

  const allLinkageRules = collectAllLinkageRules(schema.fields, schema.linkageRules)
  const allOf = allLinkageRules.length > 0 ? buildLinkageAllOf(allLinkageRules) : undefined

  const order = collectFieldOrder(schema.fields)
  const groups = collectGroupNames(schema.fields)
  const columnSpans: Record<string, number> = {}

  const result: ExportedJSONSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `urn:form-builder:${schema.meta.id}:v${schema.meta.version}`,
    title: schema.meta.name,
    type: 'object',
    additionalProperties: false,
    properties,
    required,
    layout: {
      order,
      groups,
      columnSpans
    },
    form_builder_meta: {
      meta: schema.meta,
      fields: JSON.parse(JSON.stringify(schema.fields))
    }
  }

  if (allOf && allOf.length > 0) {
    result.allOf = allOf
  }

  return result
}

function guessFieldTypeFromProperty(
  key: string,
  prop: Record<string, unknown>
): { type: FieldType; field: Partial<SchemaField> } {
  const type = prop.type as string | undefined
  const format = prop.format as string | undefined
  const hasEnum = Array.isArray(prop.enum)
  const isArray = type === 'array'

  const field: Partial<SchemaField> = {
    label: (prop.title as string) || key,
    name: key,
    field: key,
    placeholder: '',
    helpText: prop.description as string | undefined,
    hint: prop.description as string | undefined,
    defaultValue: prop.default
  }

  if (isArray) {
    const items = prop.items as Record<string, unknown> | undefined
    const itemsArray = Array.isArray(items) ? items : undefined
    const itemsObj = !Array.isArray(items) ? items : undefined

    if (itemsArray && itemsArray.length >= 2) {
      field.type = 'cascader'
      return { type: 'cascader', field }
    }

    if (itemsObj && itemsObj.type === 'object' && itemsObj.properties) {
      const props = itemsObj.properties as Record<string, unknown>
      if (props.name && props.size && props.type) {
        field.type = 'upload'
        if (!prop.maxItems || (prop.maxItems as number) > 1) {
          field.multiple = true
        }
        return { type: 'upload', field }
      }
    }

    if (itemsObj && itemsObj.enum) {
      const options = (itemsObj.enum as (string | number)[]).map((v) => ({
        label: String(v),
        value: v
      }))
      field.options = options
      field.type = 'checkbox'
      field.validation = []
      if (prop.minItems !== undefined) {
        field.validation.push({ type: 'minLength', value: prop.minItems })
      }
      return { type: 'checkbox', field }
    }
  }

  if (type === 'boolean') {
    field.type = 'switch'
    return { type: 'switch', field }
  }

  if (type === 'number' || type === 'integer') {
    if (prop.multipleOf !== undefined && (prop.multipleOf as number) === 1 &&
        prop.maximum !== undefined && (prop.maximum as number) <= 10) {
      field.type = 'rating'
      field.maxRate = prop.maximum as number
    } else if (prop.multipleOf !== undefined) {
      field.type = 'slider'
      field.step = prop.multipleOf as number
    } else {
      field.type = 'number'
    }
    if (prop.minimum !== undefined) {
      field.min = prop.minimum as number
      field.validation = field.validation || []
      field.validation.push({ type: 'min', value: prop.minimum })
    }
    if (prop.maximum !== undefined) {
      field.max = prop.maximum as number
      field.validation = field.validation || []
      field.validation.push({ type: 'max', value: prop.maximum })
    }
    return { type: field.type!, field }
  }

  if (type === 'string') {
    switch (format) {
      case 'date':
        field.type = 'date'
        return { type: 'date', field }
      case 'time':
        field.type = 'time'
        return { type: 'time', field }
      case 'date-time':
        field.type = 'date'
        return { type: 'date', field }
      default:
        break
    }

    if (hasEnum) {
      const options = (prop.enum as (string | number)[]).map((v) => ({
        label: String(v),
        value: v
      }))
      field.options = options
      field.type = 'select'
      return { type: 'select', field }
    }

    if (prop.maxLength !== undefined && (prop.maxLength as number) > 200) {
      field.type = 'textarea'
    } else if (prop.pattern || prop.minLength || prop.maxLength) {
      field.type = 'input'
    } else {
      field.type = 'input'
    }

    field.validation = field.validation || []
    if (prop.minLength !== undefined) {
      field.validation.push({ type: 'minLength', value: prop.minLength })
    }
    if (prop.maxLength !== undefined) {
      field.validation.push({ type: 'maxLength', value: prop.maxLength })
    }
    if (prop.pattern) {
      field.validation.push({ type: 'pattern', value: prop.pattern })
    }
    if (format === 'email') {
      field.validation.push({ type: 'email' })
    }
    if (format === 'uri') {
      field.validation.push({ type: 'url' })
    }
    if (field.validation.length === 0) {
      delete field.validation
    }

    return { type: field.type!, field }
  }

  field.type = 'input'
  return { type: 'input', field }
}

function schemaFieldsFromProperties(
  exported: ExportedJSONSchema
): SchemaField[] {
  const properties = exported.properties || {}
  const required = exported.required || []
  const order = exported.layout?.order || Object.keys(properties)
  const groups = exported.layout?.groups || []

  const orderedKeys = order.filter((k) => k in properties)
  const remainingKeys = Object.keys(properties).filter((k) => !order.includes(k))
  const allKeys = [...orderedKeys, ...remainingKeys]

  const fields: SchemaField[] = []

  for (const key of allKeys) {
    const prop = properties[key] as Record<string, unknown>
    const { field: partialField } = guessFieldTypeFromProperty(key, prop)

    const id = generateId()
    const isRequired = required.includes(key)

    const config: Record<string, unknown> = { ...(partialField.config || {}) }
    if (isRequired) config.required = true
    if (partialField.placeholder) config.placeholder = partialField.placeholder
    if (partialField.defaultValue !== undefined) config.defaultValue = partialField.defaultValue

    const validation: ValidationRule[] = partialField.validation || []
    if (isRequired) {
      if (!validation.some((r) => r.type === 'required')) {
        validation.unshift({ type: 'required' })
      }
    }

    const field: SchemaField = {
      id,
      type: partialField.type || 'input',
      label: partialField.label || key,
      name: key,
      field: key,
      placeholder: partialField.placeholder || '',
      helpText: partialField.helpText,
      hint: partialField.hint,
      defaultValue: partialField.defaultValue,
      options: partialField.options,
      cascaderOptions: partialField.cascaderOptions,
      config: Object.keys(config).length > 0 ? config : { required: isRequired },
      validation,
      linkages: [],
      inline: partialField.inline,
      maxRate: partialField.maxRate,
      min: partialField.min,
      max: partialField.max,
      step: partialField.step,
      accept: partialField.accept,
      multiple: partialField.multiple,
      collapsed: partialField.collapsed,
      fields: partialField.fields,
      children: partialField.children
    }

    fields.push(field)
  }

  if (groups.length > 0 && fields.length > 0) {
    return wrapFieldsInGroups(fields, groups, exported.layout?.columnSpans || {})
  }

  return fields
}

function wrapFieldsInGroups(
  fields: SchemaField[],
  _groupNames: string[],
  _columnSpans: Record<string, number>
): SchemaField[] {
  if (fields.length <= 3) return fields
  return fields
}

export function jsonSchemaToFormSchema(exported: ExportedJSONSchema): FormSchema {
  let fields: SchemaField[]
  let meta: FormMeta

  if (exported.form_builder_meta?.fields && exported.form_builder_meta.fields.length > 0) {
    fields = JSON.parse(JSON.stringify(exported.form_builder_meta.fields))
  } else {
    fields = schemaFieldsFromProperties(exported)
  }

  const now = new Date().toISOString()

  if (exported.form_builder_meta?.meta) {
    meta = {
      id: exported.form_builder_meta.meta.id || generateId(),
      name: exported.form_builder_meta.meta.name || exported.title || '未命名表单',
      tenantId: exported.form_builder_meta.meta.tenantId || 'default',
      status: (exported.form_builder_meta.meta.status || 'idle') as FormStatus,
      version: exported.form_builder_meta.meta.version || CURRENT_VERSION,
      description: exported.form_builder_meta.meta.description,
      createdAt: exported.form_builder_meta.meta.createdAt || now,
      updatedAt: now,
      author: exported.form_builder_meta.meta.author,
      tags: exported.form_builder_meta.meta.tags,
      history: exported.form_builder_meta.meta.history || [
        { timestamp: now, action: 'create', operator: 'import' }
      ]
    }
  } else {
    const idFromUrn = exported.$id?.split(':')?.[2] || generateId()
    const versionFromUrn = exported.$id?.split(':v')?.[1] || CURRENT_VERSION
    meta = {
      id: idFromUrn,
      name: exported.title || '未命名表单',
      tenantId: 'default',
      status: 'idle',
      version: versionFromUrn || CURRENT_VERSION,
      createdAt: now,
      updatedAt: now,
      history: [
        { timestamp: now, action: 'create', operator: 'import' }
      ]
    }
  }

  const schema: FormSchema = {
    meta,
    fields
  }

  if (exported.allOf && exported.allOf.length > 0) {
    schema.linkageRules = allOfToLinkageRules(exported.allOf)
  }

  return schema
}

function allOfToLinkageRules(
  allOf: Array<{
    if: Record<string, unknown>
    then?: Record<string, unknown>
    else?: Record<string, unknown>
  }>
): LinkageRule[] {
  const rules: LinkageRule[] = []

  for (const item of allOf) {
    const conditions = parseIfSchema(item.if)
    if (conditions.length === 0) continue

    let logic: 'and' | 'or' = 'and'
    if (item.if && item.if.anyOf && Array.isArray((item.if as Record<string, unknown>).anyOf)) {
      logic = 'or'
    }

    let action: LinkageAction = { type: 'show', target: '' }
    const thenSchema = item.then as Record<string, unknown> | undefined
    const notSchema = thenSchema?.not as Record<string, unknown> | undefined

    const targets: string[] = []
    if (thenSchema?.required && Array.isArray(thenSchema.required)) {
      action = { type: 'setRequired', target: thenSchema.required[0] || '' }
      targets.push(...(thenSchema.required as string[]))
    } else if (notSchema?.required && Array.isArray(notSchema.required)) {
      action = { type: 'setOptional', target: notSchema.required[0] || '' }
      targets.push(...(notSchema.required as string[]))
    }

    const firstTarget = conditions.length > 0 ? getConditionField(conditions[0]) : ''
    if (!action.target && firstTarget) {
      action = { ...action, target: firstTarget }
    }
    if (targets.length === 0 && firstTarget) {
      targets.push(firstTarget)
    }

    rules.push({
      id: generateId(),
      enabled: true,
      logic,
      conditions,
      actions: targets.map((t) => ({ ...action, target: t }))
    })
  }

  return rules
}

function parseIfSchema(
  ifSchema: Record<string, unknown>
): LinkageCondition[] {
  const conditions: LinkageCondition[] = []

  if (ifSchema.allOf && Array.isArray(ifSchema.allOf)) {
    for (const sub of ifSchema.allOf as Record<string, unknown>[]) {
      conditions.push(...parseIfSchema(sub))
    }
    return conditions
  }

  if (ifSchema.anyOf && Array.isArray(ifSchema.anyOf)) {
    for (const sub of ifSchema.anyOf as Record<string, unknown>[]) {
      conditions.push(...parseIfSchema(sub))
    }
    return conditions
  }

  const props = ifSchema.properties as Record<string, unknown> | undefined
  const required = ifSchema.required as string[] | undefined
  if (!props || !required || required.length === 0) return conditions

  for (const field of required) {
    const prop = props[field] as Record<string, unknown> | undefined
    if (!prop) continue

    const condition = parseConditionProp(field, prop)
    if (condition) {
      conditions.push(condition)
    }
  }

  return conditions
}

function parseConditionProp(
  field: string,
  prop: Record<string, unknown>
): LinkageCondition | null {
  if ('const' in prop) {
    return { fieldId: field, operator: 'eq', value: prop.const }
  }

  if ('not' in prop) {
    const not = prop.not as Record<string, unknown>
    if ('const' in not) {
      return { fieldId: field, operator: 'ne', value: not.const }
    }
    if (not.anyOf) {
      return { fieldId: field, operator: 'notempty', value: undefined }
    }
  }

  if (prop.type === 'number') {
    if ('exclusiveMinimum' in prop) {
      return { fieldId: field, operator: 'gt', value: prop.exclusiveMinimum }
    }
    if ('exclusiveMaximum' in prop) {
      return { fieldId: field, operator: 'lt', value: prop.exclusiveMaximum }
    }
    if ('minimum' in prop) {
      return { fieldId: field, operator: 'gte', value: prop.minimum }
    }
    if ('maximum' in prop) {
      return { fieldId: field, operator: 'lte', value: prop.maximum }
    }
  }

  if ('enum' in prop) {
    return { fieldId: field, operator: 'in', value: prop.enum }
  }

  if (prop.type === 'string' && 'pattern' in prop) {
    return { fieldId: field, operator: 'contains', value: prop.pattern }
  }

  if (prop.type === 'array' && 'contains' in prop) {
    const contains = prop.contains as Record<string, unknown>
    return { fieldId: field, operator: 'contains', value: contains.const }
  }

  if ('anyOf' in prop) {
    const anyOf = prop.anyOf as Record<string, unknown>[]
    const isEmptyCheck = anyOf.some(
      (s) => s.maxLength === 0 || s.maxItems === 0 || s.type === 'null'
    )
    if (isEmptyCheck) {
      return { fieldId: field, operator: 'empty', value: undefined }
    }
  }

  return null
}

export function migrateSchema(
  data: unknown,
  targetVersion: string = CURRENT_VERSION
): { schema: FormSchema; warnings: string[] } {
  const warnings: string[] = []
  let working: Record<string, unknown>

  try {
    working = JSON.parse(JSON.stringify(data)) as Record<string, unknown>
  } catch {
    working = data as Record<string, unknown>
  }

  const getCurrentVersion = (): string => {
    const meta = working.meta as Record<string, unknown> | undefined
    if (meta?.version) return String(meta.version)
    if (working.version) return String(working.version)
    return '0.0.0'
  }

  const currentVersion = getCurrentVersion()

  const versionCompare = (a: string, b: string): number => {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const ai = aParts[i] || 0
      const bi = bParts[i] || 0
      if (ai !== bi) return ai - bi
    }
    return 0
  }

  const now = new Date().toISOString()

  const ensureFormSchema = (d: Record<string, unknown>): FormSchema => {
    const metaRaw = d.meta as Record<string, unknown> | undefined
    const meta: FormMeta = {
      id: (metaRaw?.id as string) || generateId(),
      name: (metaRaw?.name as string) || '未命名表单',
      tenantId: (metaRaw?.tenantId as string) || 'default',
      status: (metaRaw?.status as FormStatus) || 'idle',
      version: targetVersion,
      description: metaRaw?.description as string | undefined,
      createdAt: (metaRaw?.createdAt as string) || now,
      updatedAt: now,
      author: metaRaw?.author as string | undefined,
      tags: metaRaw?.tags as string[] | undefined,
      history: (metaRaw?.history as FormMeta['history']) || [
        { timestamp: now, action: 'create', operator: 'migration' }
      ]
    }

    let fields: SchemaField[] = []
    if (Array.isArray(d.fields)) {
      fields = d.fields as SchemaField[]
    } else if (Array.isArray(d.schema)) {
      fields = d.schema as SchemaField[]
    }

    return {
      meta,
      fields,
      linkageRules: Array.isArray(d.linkageRules) ? (d.linkageRules as LinkageRule[]) : [],
      config: (d.config as Record<string, unknown>) || {},
      validation: Array.isArray(d.validation) ? (d.validation as ValidationRule[]) : []
    }
  }

  const migrateFields = (
    fields: SchemaField[],
    migrator: (f: SchemaField) => SchemaField
  ): SchemaField[] => {
    return fields.map((f) => {
      const migrated = migrator({ ...f })
      const children = migrated.fields || migrated.children
      if (migrated.type === 'group' && children) {
        const newChildren = migrateFields(children, migrator)
        migrated.fields = newChildren
        migrated.children = newChildren
      }
      return migrated
    })
  }

  if (versionCompare(currentVersion, '1.0.0') < 0) {
    warnings.push('[0.0.0 → 1.0.0] 迁移：补全 config/validation 空数组、补全 id/uuid')

    const fields = (working.fields || working.schema || []) as SchemaField[]
    const migratedFields = migrateFields(fields, (f) => {
      if (!f.id) {
        f.id = generateId()
        warnings.push(`[0.0.0 → 1.0.0] 字段 ${f.name || f.field || '(未命名)'} 缺少 id，已生成新 id: ${f.id}`)
      }
      if (!f.name && f.field) {
        f.name = f.field
      }
      if (!f.config) {
        f.config = { required: false }
      }
      if (!f.validation || !Array.isArray(f.validation)) {
        f.validation = []
      }
      if (!f.linkages || !Array.isArray(f.linkages)) {
        f.linkages = []
      }
      return f
    })
    working.fields = migratedFields

    if (!working.config) {
      working.config = {}
    }
    if (!working.validation || !Array.isArray(working.validation)) {
      working.validation = []
    }
  }

  if (versionCompare(currentVersion, '1.1.0') < 0 && versionCompare(targetVersion, '1.1.0') >= 0) {
    warnings.push('[1.0.0 → 1.1.0] 迁移：补全 linkageRules')

    const fields = (working.fields || []) as SchemaField[]
    const migratedFields = migrateFields(fields, (f) => {
      if (!f.linkages || !Array.isArray(f.linkages)) {
        f.linkages = []
      }
      if ((f.type === 'radio' || f.type === 'checkbox') && f.inline === undefined) {
        f.inline = false
        warnings.push(`[1.0.0 → 1.1.0] 字段 ${f.name || f.label} 补全 inline: false`)
      }
      if (f.type === 'rating' && !f.maxRate) {
        f.maxRate = 5
        warnings.push(`[1.0.0 → 1.1.0] 字段 ${f.name || f.label} 补全 maxRate: 5`)
      }
      return f
    })
    working.fields = migratedFields

    if (!working.linkageRules || !Array.isArray(working.linkageRules)) {
      working.linkageRules = []
    }
  }

  if (versionCompare(currentVersion, '1.2.0') < 0 && versionCompare(targetVersion, '1.2.0') >= 0) {
    warnings.push('[1.1.0 → 1.2.0] 迁移：补全 cascaderOptions/slider step')

    const fields = (working.fields || []) as SchemaField[]
    const migratedFields = migrateFields(fields, (f) => {
      if (f.type === 'cascader' && !f.cascaderOptions) {
        f.cascaderOptions = []
        warnings.push(`[1.1.0 → 1.2.0] 级联字段 ${f.name || f.label} 补全空 cascaderOptions`)
      }
      if (f.type === 'slider' && f.step === undefined) {
        f.step = 1
        warnings.push(`[1.1.0 → 1.2.0] 滑块字段 ${f.name || f.label} 补全 step: 1`)
      }
      if (f.type === 'upload' && f.multiple === undefined) {
        f.multiple = false
        warnings.push(`[1.1.0 → 1.2.0] 上传字段 ${f.name || f.label} 补全 multiple: false`)
      }
      if (f.type === 'group' && f.collapsed === undefined) {
        f.collapsed = false
        warnings.push(`[1.1.0 → 1.2.0] 分组 ${f.name || f.label} 补全 collapsed: false`)
      }
      return f
    })
    working.fields = migratedFields
  }

  const schema = ensureFormSchema(working)
  schema.meta.version = targetVersion

  return { schema, warnings }
}

export function downloadJSONSchema(
  exported: ExportedJSONSchema,
  filename?: string
): void {
  const json = JSON.stringify(exported, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const actualFilename = filename ||
    `form-schema-${exported.$id.split(':').pop()}-${Date.now()}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = actualFilename

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
