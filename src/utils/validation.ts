import type { SchemaField, ValidationRule, LinkageCondition, LinkageRule, FieldConfig } from '@/types'

export interface ValidationResult {
  valid: boolean
  message?: string
}

export interface FieldValidationResult {
  field: string
  valid: boolean
  message?: string
}

export interface LinkageEffectLocal {
  visible: Record<string, boolean>
  disabled: Record<string, boolean>
  required: Record<string, boolean | null>
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^1[3-9]\d{9}$/
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
const IDCARD_REGEX = /(^\d{15}$)|(^\d{17}(\d|X|x)$)/

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function evaluateCondition(
  condition: LinkageCondition,
  allValues: Record<string, unknown>
): boolean {
  const value = allValues[condition.fieldId]
  const condValue = condition.value

  switch (condition.operator) {
    case '==':
    case 'eq':
      return value === condValue
    case '!=':
    case 'ne':
      return value !== condValue
    case '>':
    case 'gt':
      return Number(value) > Number(condValue)
    case '<':
    case 'lt':
      return Number(value) < Number(condValue)
    case '>=':
    case 'gte':
      return Number(value) >= Number(condValue)
    case '<=':
    case 'lte':
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
      return isEmpty(value)
    case 'notEmpty':
    case 'notempty':
      return !isEmpty(value)
    default:
      return false
  }
}

export function evaluateLinkageRule(
  rule: LinkageRule,
  allValues: Record<string, unknown>
): boolean {
  const conditions = rule.conditions || []
  const logic = (rule.logic || 'AND').toString().toUpperCase()
  if (logic === 'AND') {
    return conditions.every(c => evaluateCondition(c, allValues))
  } else {
    return conditions.some(c => evaluateCondition(c, allValues))
  }
}

export function evaluateLinkageRules(
  fields: SchemaField[],
  rules: (LinkageRule & { triggerField: string })[],
  allValues: Record<string, unknown>
): LinkageEffectLocal {
  const visible: Record<string, boolean> = {}
  const disabled: Record<string, boolean> = {}
  const required: Record<string, boolean | null> = {}

  fields.forEach(f => {
    visible[f.name] = true
    disabled[f.name] = false
    required[f.name] = null
  })

  for (const rule of rules) {
    const conditionResult = evaluateLinkageRule(rule, allValues)
    const targetFieldName = rule.triggerField
    const ruleAction = rule.action || (rule.actions && rule.actions[0]?.type) || 'show'

    switch (ruleAction) {
      case 'show':
        if (!conditionResult) visible[targetFieldName] = false
        break
      case 'hide':
        if (conditionResult) visible[targetFieldName] = false
        break
      case 'enable':
        if (!conditionResult) disabled[targetFieldName] = true
        break
      case 'disable':
        if (conditionResult) disabled[targetFieldName] = true
        break
      case 'setRequired':
        if (conditionResult) required[targetFieldName] = true
        break
      case 'setOptional':
        if (conditionResult) required[targetFieldName] = false
        break
    }
  }

  return { visible, disabled, required }
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
  }
  return false
}

export function validateField(
  field: SchemaField,
  value: unknown,
  allValues: Record<string, unknown> = {}
): ValidationResult {
  if (field.type === 'group') {
    return { valid: true }
  }

  const linkageEffect = evaluateFieldLinkageEffect(field, allValues)
  if (linkageEffect && !linkageEffect.visible) {
    return { valid: true }
  }

  const effectiveRequired = linkageEffect?.required === null
    ? isFieldRequired(field)
    : linkageEffect?.required ?? isFieldRequired(field)

  if (effectiveRequired && isEmpty(value)) {
    const msg = getRuleMessage(field.validation, 'required') || `${field.label}不能为空`
    return { valid: false, message: msg }
  }

  if (isEmpty(value)) {
    return { valid: true }
  }

  const rules = Array.isArray(field.validation) ? field.validation : []

  for (const rule of rules) {
    const result = applyValidationRule(rule, value, field.label)
    if (!result.valid) {
      return result
    }
  }

  if (field.config) {
    const cfg = field.config as FieldConfig & { minLength?: number; maxLength?: number; min?: number; max?: number }
    const strValue = String(value)
    const numValue = Number(value)

    if (cfg.minLength !== undefined && strValue.length < Number(cfg.minLength)) {
      return { valid: false, message: `最少输入${cfg.minLength}个字符` }
    }
    if (cfg.maxLength !== undefined && strValue.length > Number(cfg.maxLength)) {
      return { valid: false, message: `最多输入${cfg.maxLength}个字符` }
    }
    if (cfg.min !== undefined && numValue < Number(cfg.min)) {
      return { valid: false, message: `最小值为${cfg.min}` }
    }
    if (cfg.max !== undefined && numValue > Number(cfg.max)) {
      return { valid: false, message: `最大值为${cfg.max}` }
    }
  }

  return { valid: true }
}

function getRuleMessage(rules: ValidationRule[] | undefined, type: string): string | undefined {
  if (!rules) return undefined
  const rule = rules.find(r => r.type === type)
  return rule?.message
}

function applyValidationRule(rule: ValidationRule, value: unknown, label: string): ValidationResult {
  const strValue = String(value)
  const numValue = Number(value)
  const ruleValue = rule.value
  const message = rule.message

  switch (rule.type) {
    case 'required':
      if (isEmpty(value)) {
        return { valid: false, message: message || `${label}不能为空` }
      }
      break
    case 'minLength':
    case 'minlength':
      if (strValue.length < Number(ruleValue)) {
        return { valid: false, message: message || `最少输入${ruleValue}个字符` }
      }
      break
    case 'maxLength':
    case 'maxlength':
      if (strValue.length > Number(ruleValue)) {
        return { valid: false, message: message || `最多输入${ruleValue}个字符` }
      }
      break
    case 'min':
      if (numValue < Number(ruleValue)) {
        return { valid: false, message: message || `最小值为${ruleValue}` }
      }
      break
    case 'max':
      if (numValue > Number(ruleValue)) {
        return { valid: false, message: message || `最大值为${ruleValue}` }
      }
      break
    case 'pattern': {
      try {
        const regex = new RegExp(String(ruleValue))
        if (!regex.test(strValue)) {
          return { valid: false, message: message || '格式不正确' }
        }
      } catch {
        // 忽略无效正则
      }
      break
    }
    case 'email':
      if (!EMAIL_REGEX.test(strValue)) {
        return { valid: false, message: message || '请输入正确的邮箱地址' }
      }
      break
    case 'url':
      if (!URL_REGEX.test(strValue)) {
        return { valid: false, message: message || '请输入正确的URL地址' }
      }
      break
    case 'phone':
      if (!PHONE_REGEX.test(strValue)) {
        return { valid: false, message: message || '请输入正确的手机号码' }
      }
      break
    case 'idcard':
      if (!IDCARD_REGEX.test(strValue)) {
        return { valid: false, message: message || '请输入正确的身份证号' }
      }
      break
  }

  return { valid: true }
}

function evaluateFieldLinkageEffect(
  field: SchemaField,
  allValues: Record<string, unknown>
): { visible: boolean; disabled: boolean; required: boolean | null } | null {
  const rules = field.linkages
  if (!rules || rules.length === 0) {
    return null
  }

  let visible = true
  let disabled = false
  let required: boolean | null = null

  for (const rule of rules) {
    if (!rule.enabled && rule.enabled !== undefined) continue
    const conditionResult = evaluateLinkageRule(rule, allValues)
    const ruleAction = rule.action || (rule.actions && rule.actions[0]?.type) || 'show'
    switch (ruleAction) {
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

export function validateAllFields(
  fields: SchemaField[],
  values: Record<string, unknown>
): FieldValidationResult[] {
  const results: FieldValidationResult[] = []
  const walk = (list: SchemaField[]) => {
    for (const f of list) {
      if (f.type === 'group') {
        const children = f.children || f.fields
        if (children?.length) walk(children)
        continue
      }
      const fieldName = f.name || f.field || ''
      const value = values[fieldName]
      const result = validateField(f, value, values)
      results.push({
        field: fieldName,
        valid: result.valid,
        message: result.message
      })
    }
  }
  walk(fields)
  return results
}

export function isFormValid(results: FieldValidationResult[]): boolean {
  return results.every(r => r.valid)
}

export function getFieldErrors(results: FieldValidationResult[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const r of results) {
    if (!r.valid && r.message) {
      errors[r.field] = r.message
    }
  }
  return errors
}
