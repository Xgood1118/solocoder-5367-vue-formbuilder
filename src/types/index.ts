export type FieldType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'time'
  | 'rating'
  | 'upload'
  | 'group'
  | 'slider'
  | 'cascader'
  | 'richtext'

export type FormStatus = 'idle' | 'editing' | 'previewing' | 'published' | 'archived'

export interface FieldOption {
  label: string
  value: string | number
}

export interface CascaderOption {
  label: string
  value: string | number
  children?: CascaderOption[]
}

export type ValidationRuleType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'minlength'
  | 'maxlength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'email'
  | 'phone'
  | 'url'
  | 'idcard'
  | 'custom'

export interface ValidationRule {
  type: ValidationRuleType
  value?: unknown
  message?: string
  expression?: string
}

export interface FieldConfig {
  required?: boolean
  placeholder?: string
  defaultValue?: unknown
  helpText?: string
  [key: string]: unknown
}

export type LinkageOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'in'
  | 'empty'
  | 'notempty'
  | 'between'
  | 'regex'
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'notEmpty'

export interface LinkageCondition {
  fieldId: string
  operator: LinkageOperator
  value: unknown
}

export type LinkageActionType =
  | 'show'
  | 'hide'
  | 'enable'
  | 'disable'
  | 'setRequired'
  | 'setOptional'
  | 'setValue'

export interface LinkageAction {
  type: LinkageActionType
  target: string
  value?: unknown
}

export interface LinkageRule {
  id?: string
  enabled?: boolean
  logic?: 'and' | 'or' | 'AND' | 'OR'
  conditions?: LinkageCondition[]
  actions?: LinkageAction[]
  action?: LinkageActionType
}

export interface UploadedFile {
  name: string
  size: number
  type: string
  url?: string
}

export interface SchemaField {
  id: string
  type: FieldType
  label: string
  name: string
  field?: string
  placeholder?: string
  helpText?: string
  hint?: string
  defaultValue?: unknown
  options?: FieldOption[]
  cascaderOptions?: CascaderOption[]
  config?: FieldConfig
  validation?: ValidationRule[]
  rules?: ValidationRule | ValidationRule[]
  linkages?: LinkageRule[]
  inline?: boolean
  maxRate?: number
  min?: number
  max?: number
  step?: number
  accept?: string
  multiple?: boolean
  collapsed?: boolean
  fields?: SchemaField[]
  children?: SchemaField[]
  [key: string]: unknown
}

export interface FormMetaHistoryItem {
  timestamp: string
  action: 'create' | 'update' | 'publish' | 'archive'
  operator: string
  fromStatus?: FormStatus
  toStatus?: FormStatus
}

export interface FormMeta {
  id: string
  name: string
  tenantId: string
  status: FormStatus
  version: string
  description?: string
  createdAt: string
  updatedAt: string
  author?: string
  tags?: string[]
  history: FormMetaHistoryItem[]
  [key: string]: unknown
}

export interface FormSchema {
  meta: FormMeta
  fields: SchemaField[]
  linkageRules?: LinkageRule[]
  config?: Record<string, unknown>
  validation?: ValidationRule[]
}

export interface ToastPayload {
  id?: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
}

export interface PresetItem {
  id: string
  name: string
  data: unknown
  createdAt: string
}

export interface RuntimeState {
  visibility: Record<string, boolean>
  disabled: Record<string, boolean>
  requiredOverride: Record<string, boolean>
  values: Record<string, unknown>
}

export interface JSONSchemaProperty {
  type?: string | string[]
  title?: string
  description?: string
  default?: unknown
  enum?: (string | number)[]
  items?: JSONSchemaProperty | JSONSchemaProperty[]
  properties?: Record<string, JSONSchemaProperty>
  additionalProperties?: boolean
  format?: string
  pattern?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  multipleOf?: number
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  required?: string[]
  allOf?: unknown[]
  anyOf?: unknown[]
  oneOf?: unknown[]
  not?: unknown
  if?: unknown
  then?: unknown
  else?: unknown
  [key: string]: unknown
}

export interface ExportedJSONSchema extends JSONSchemaProperty {
  $schema: string
  $id: string
  type: 'object'
  title: string
  additionalProperties: false
  properties: Record<string, JSONSchemaProperty>
  required: string[]
  allOf?: Array<{
    if: Record<string, unknown>
    then?: Record<string, unknown>
    else?: Record<string, unknown>
  }>
  layout: {
    order: string[]
    groups: string[]
    columnSpans: Record<string, number>
  }
  form_builder_meta: {
    meta: FormMeta
    fields: SchemaField[]
  }
}
