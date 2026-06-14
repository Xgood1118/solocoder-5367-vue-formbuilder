<script setup lang="ts">
import { ref, computed, defineComponent, h, provide, inject, InjectionKey, shallowRef, markRaw } from 'vue'
import type { SchemaField, FieldType } from '@/types'
import { useFormStore } from '@/stores/formStore'
import { generateId } from '@/utils/schemaConverter'
import Skeleton from './Skeleton.vue'
import {
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Calendar,
  Clock,
  Star,
  Upload,
  FileText,
  AlertCircle
} from 'lucide-vue-next'

defineOptions({
  name: 'Canvas'
})

interface Props {
  schema?: SchemaField[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  schema: undefined,
  loading: false
})

const store = useFormStore()

const effectiveFields = computed(() => props.schema ?? store.fields)

interface PaletteDragData {
  type: FieldType
}

interface CanvasDragData {
  id: string
  from: 'canvas'
}

type DragData = PaletteDragData | CanvasDragData

interface FieldLocation {
  parentId: string | null
  index: number
}

const dragOverFieldId = ref<string | null>(null)
const dragOverPosition = ref<'before' | 'after' | 'inside' | null>(null)

function parseDragData(e: DragEvent): DragData | null {
  try {
    const raw = e.dataTransfer?.getData('application/json')
    if (!raw) return null
    return JSON.parse(raw) as DragData
  } catch {
    return null
  }
}

function isPaletteData(data: DragData): data is PaletteDragData {
  return 'type' in data && !('from' in data)
}

function isCanvasData(data: DragData): data is CanvasDragData {
  return 'from' in data && data.from === 'canvas' && 'id' in data
}

function findFieldLocation(
  id: string,
  list: SchemaField[] = effectiveFields.value,
  parentId: string | null = null
): FieldLocation | null {
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    if (f.id === id) {
      return { parentId, index: i }
    }
    if (f.type === 'group' && f.children?.length) {
      const found = findFieldLocation(id, f.children, f.id)
      if (found) return found
    }
  }
  return null
}

function isRequired(field: SchemaField): boolean {
  if (field.config?.required) return true
  if (field.validation?.some(v => v.type === 'required')) return true
  return false
}

function createFieldFromType(type: FieldType): SchemaField {
  const labelMap: Record<FieldType, string> = {
    input: '文本输入',
    number: '数字输入',
    textarea: '多行文本',
    select: '下拉选择',
    radio: '单选框',
    checkbox: '多选框',
    switch: '开关',
    date: '日期选择',
    time: '时间选择',
    rating: '评分',
    upload: '文件上传',
    cascader: '级联选择',
    richtext: '富文本',
    group: '分组',
    slider: '滑块'
  }
  const prefixMap: Record<FieldType, string> = {
    input: 'text',
    number: 'num',
    textarea: 'desc',
    select: 'sel',
    radio: 'opt',
    checkbox: 'chk',
    switch: 'sw',
    date: 'dt',
    time: 'tm',
    rating: 'rate',
    upload: 'file',
    cascader: 'casc',
    richtext: 'rt',
    group: 'grp',
    slider: 'sld'
  }

  const id = generateId()
  const prefix = prefixMap[type] || 'field'
  const name = `${prefix}_${id.slice(0, 6)}`
  const label = labelMap[type] || '未知字段'

  const defaultOptions = [
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
    placeholder: `请输入${label}`,
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
    children: undefined
  }

  switch (type) {
    case 'input':
      base.defaultValue = ''
      break
    case 'number':
      base.defaultValue = 0
      base.min = 0
      base.max = 1000000
      base.step = 1
      break
    case 'textarea':
      base.defaultValue = ''
      break
    case 'select':
      base.defaultValue = ''
      base.options = [...defaultOptions]
      break
    case 'radio':
      base.defaultValue = ''
      base.options = [...defaultOptions]
      base.inline = true
      break
    case 'checkbox':
      base.defaultValue = []
      base.options = [...defaultOptions]
      base.inline = true
      break
    case 'switch':
      base.defaultValue = false
      break
    case 'date':
    case 'time':
      base.defaultValue = ''
      break
    case 'rating':
      base.defaultValue = 0
      base.maxRate = 5
      break
    case 'upload':
      base.defaultValue = []
      base.multiple = true
      break
    case 'slider':
      base.defaultValue = 0
      base.min = 0
      base.max = 100
      base.step = 1
      break
    case 'cascader':
      base.defaultValue = []
      base.cascaderOptions = [
        {
          label: '选项1',
          value: 'opt1',
          children: [
            { label: '子选项1-1', value: 'opt1-1' },
            { label: '子选项1-2', value: 'opt1-2' }
          ]
        },
        {
          label: '选项2',
          value: 'opt2',
          children: [
            { label: '子选项2-1', value: 'opt2-1' },
            { label: '子选项2-2', value: 'opt2-2' }
          ]
        }
      ]
      break
    case 'richtext':
      base.defaultValue = ''
      break
    case 'group':
      base.defaultValue = undefined
      base.collapsed = false
      base.children = []
      break
  }

  return base
}

interface FieldCardInjection {
  onFieldDragStart: (e: DragEvent, fieldId: string) => void
  onFieldDragOver: (e: DragEvent, field: SchemaField) => void
  onFieldDragLeave: () => void
  onFieldDrop: (e: DragEvent, field: SchemaField) => void
}

const FieldCardKey: InjectionKey<FieldCardInjection> = Symbol('FieldCard')

function handleFieldDragStart(e: DragEvent, fieldId: string) {
  const data: CanvasDragData = { id: fieldId, from: 'canvas' }
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/json', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'move'
  }
}

function handleFieldDragOver(e: DragEvent, field: SchemaField) {
  e.preventDefault()
  e.stopPropagation()

  const dragData = parseDragData(e)
  if (!dragData) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  const height = rect.height
  const threshold = height * 0.25

  dragOverFieldId.value = field.id

  if (field.type === 'group' && y > threshold && y < height - threshold) {
    dragOverPosition.value = 'inside'
  } else if (y < height / 2) {
    dragOverPosition.value = 'before'
  } else {
    dragOverPosition.value = 'after'
  }
}

function handleFieldDragLeave() {
  dragOverFieldId.value = null
  dragOverPosition.value = null
}

function handleFieldDrop(e: DragEvent, field: SchemaField) {
  e.preventDefault()
  e.stopPropagation()

  const dragData = parseDragData(e)
  if (!dragData) return

  const position = dragOverPosition.value
  if (!position) return

  if (isPaletteData(dragData)) {
    const newField = createFieldFromType(dragData.type)
    if (position === 'inside') {
      store.addField(newField, { parentId: field.id })
    } else {
      const loc = findFieldLocation(field.id)
      if (loc) {
        const idx = position === 'before' ? loc.index : loc.index + 1
        store.addField(newField, { parentId: loc.parentId || undefined, index: idx })
      }
    }
  } else if (isCanvasData(dragData) && dragData.id !== field.id) {
    if (position === 'inside') {
      store.moveField(dragData.id, { parentId: field.id, index: 0 })
    } else {
      const loc = findFieldLocation(field.id)
      if (loc) {
        const idx = position === 'before' ? loc.index : loc.index + 1
        store.moveField(dragData.id, { parentId: loc.parentId || undefined, index: idx })
      }
    }
  }

  dragOverFieldId.value = null
  dragOverPosition.value = null
}

const injectionValue: FieldCardInjection = {
  onFieldDragStart: handleFieldDragStart,
  onFieldDragOver: handleFieldDragOver,
  onFieldDragLeave: handleFieldDragLeave,
  onFieldDrop: handleFieldDrop
}

provide(FieldCardKey, injectionValue)

function handleCanvasDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function handleCanvasDrop(e: DragEvent) {
  e.preventDefault()

  const dragData = parseDragData(e)
  if (!dragData) return

  if (isPaletteData(dragData)) {
    const newField = createFieldFromType(dragData.type)
    store.addField(newField)
  }

  dragOverFieldId.value = null
  dragOverPosition.value = null
}

// ---------- 只读预览渲染 (避免 FieldRenderer 类型不兼容) ----------

function renderFieldPreview(field: SchemaField) {
  const ph = field.placeholder || ''
  const baseInputCls = 'preview-input'
  const opts = field.options || []

  switch (field.type) {
    case 'input':
      return h('input', {
        type: 'text',
        class: baseInputCls,
        placeholder: ph,
        disabled: true
      })

    case 'number':
      return h('input', {
        type: 'number',
        class: baseInputCls,
        placeholder: ph,
        disabled: true
      })

    case 'textarea':
      return h('textarea', {
        class: 'preview-textarea',
        placeholder: ph,
        disabled: true
      })

    case 'select':
      return h(
        'select',
        { class: 'preview-select', disabled: true },
        [
          h('option', { value: '', disabled: true }, ph || '请选择'),
          ...opts.map(o => h('option', { key: String(o.value), value: o.value }, o.label))
        ]
      )

    case 'radio':
      return h(
        'div',
        { class: 'preview-radio-group' + (field.inline ? ' inline' : '') },
        opts.map(o =>
          h(
            'label',
            { key: String(o.value), class: 'preview-radio' },
            [
              h('input', { type: 'radio', disabled: true }),
              h('span', null, o.label)
            ]
          )
        )
      )

    case 'checkbox':
      return h(
        'div',
        { class: 'preview-checkbox-group' + (field.inline ? ' inline' : '') },
        opts.map(o =>
          h(
            'label',
            { key: String(o.value), class: 'preview-checkbox' },
            [
              h('input', { type: 'checkbox', disabled: true }),
              h('span', null, o.label)
            ]
          )
        )
      )

    case 'switch':
      return h('div', { class: 'preview-switch' }, [
        h('div', { class: 'switch-track' }),
        h('div', { class: 'switch-thumb' })
      ])

    case 'date':
      return h('div', { class: 'preview-datetime-row' }, [
        h('input', { type: 'date', class: baseInputCls, disabled: true }),
        h(Calendar, { size: 16, class: 'preview-datetime-icon' })
      ])

    case 'time':
      return h('div', { class: 'preview-datetime-row' }, [
        h('input', { type: 'time', class: baseInputCls, disabled: true }),
        h(Clock, { size: 16, class: 'preview-datetime-icon' })
      ])

    case 'rating': {
      const max = field.maxRate || 5
      const stars = []
      for (let i = 1; i <= max; i++) {
        stars.push(
          h(Star, {
            key: i,
            size: 20,
            class: 'rating-star',
            style: 'color: var(--border-color, #e2e8f0);'
          })
        )
      }
      return h('div', { class: 'preview-rating' }, stars)
    }

    case 'upload':
      return h('div', { class: 'preview-upload' }, [
        h(Upload, { size: 20 }),
        h('span', null, ph || '点击上传文件')
      ])

    case 'slider':
      return h('div', { class: 'preview-slider' }, [
        h('div', { class: 'slider-track' }, [
          h('div', { class: 'slider-fill', style: 'width: 30%;' }),
          h('div', { class: 'slider-thumb', style: 'left: 30%;' })
        ])
      ])

    case 'cascader':
      return h('div', { class: 'preview-cascader' }, [
        h('span', { class: 'placeholder' }, ph || '请选择'),
        h(ChevronDown, { size: 14 })
      ])

    case 'richtext':
      return h('div', { class: 'preview-richtext' }, [
        h(
          'div',
          { class: 'richtext-toolbar' },
          [h('b', null, 'B'), h('i', null, 'I'), h('u', null, 'U')]
        ),
        h(FileText, { size: 16, class: 'richtext-placeholder-icon' }),
        h('span', { class: 'richtext-placeholder' }, '富文本内容')
      ])

    default:
      return h('div', { class: 'preview-unknown' }, `${field.type}`)
  }
}

// ---------- FieldCard 递归组件 (defineComponent) ----------

import type { Component } from 'vue'

let FieldCardInstance: Component | null = null

interface FieldCardPropsDef {
  field: SchemaField
}

FieldCardInstance = defineComponent({
  name: 'FieldCard',
  props: {
    field: {
      type: Object as () => SchemaField,
      required: true
    }
  },
  setup(props: Readonly<FieldCardPropsDef>) {
    const injected = inject(FieldCardKey, null)
    const localStore = useFormStore()
    const hovered = ref(false)

    const isSelected = computed(() => localStore.selectedFieldId === props.field.id)
    const isDragOver = computed(() => dragOverFieldId.value === props.field.id)
    const required = computed(() => isRequired(props.field))
    const children = computed(() => props.field.children ?? [])
    const collapsed = computed(() => (props.field.collapsed as boolean | undefined) ?? false)
    const fieldName = computed(() => props.field.name || props.field.field || '')

    function onCardClick() {
      localStore.selectField(props.field.id)
    }

    function onDuplicate(e: Event) {
      e.stopPropagation()
      localStore.duplicateField(props.field.id)
    }

    function onMoveUp(e: Event) {
      e.stopPropagation()
      localStore.reorderField(props.field.id, 'up')
    }

    function onMoveDown(e: Event) {
      e.stopPropagation()
      localStore.reorderField(props.field.id, 'down')
    }

    function onRemove(e: Event) {
      e.stopPropagation()
      localStore.removeField(props.field.id)
    }

    function onToggleGroup(e: Event) {
      e.stopPropagation()
      localStore.updateField(props.field.id, { collapsed: !collapsed.value })
    }

    function onDragStart(e: DragEvent) {
      injected?.onFieldDragStart(e, props.field.id)
    }

    function onDragOver(e: DragEvent) {
      injected?.onFieldDragOver(e, props.field)
    }

    function onDragLeave() {
      injected?.onFieldDragLeave()
    }

    function onDrop(e: DragEvent) {
      injected?.onFieldDrop(e, props.field)
    }

    function onMouseEnter() {
      hovered.value = true
    }

    function onMouseLeave() {
      hovered.value = false
      injected?.onFieldDragLeave()
    }

    function onHandleMouseDown(e: Event) {
      e.stopPropagation()
    }

    return () => {
      const cardClass: Record<string, boolean> = {
        'field-wrapper': true,
        'is-selected': isSelected.value,
        'drag-over-before': isDragOver.value && dragOverPosition.value === 'before',
        'drag-over-after': isDragOver.value && dragOverPosition.value === 'after',
        'drag-over-inside': isDragOver.value && dragOverPosition.value === 'inside'
      }

      const innerClass: Record<string, boolean> = {
        'field-card': true,
        'is-group': props.field.type === 'group'
      }

      const showActions = hovered.value || isSelected.value

      const cardBody: (import('vue').VNode | null)[] =
        props.field.type === 'group'
          ? [
              h(
                'div',
                { class: 'group-header', onClick: onToggleGroup },
                [
                  h('div', { class: 'group-toggle' }, [
                    collapsed.value
                      ? h(ChevronDown, { size: 16 })
                      : h(ChevronUp, { size: 16 })
                  ]),
                  h('div', { class: 'group-info' }, [
                    h(LayoutGrid, {
                      size: 16,
                      style: 'color: var(--group-color, #8b5cf6);'
                    }),
                    h('span', { class: 'group-name' }, props.field.label),
                    h(
                      'span',
                      { class: 'group-count' },
                      `${children.value.length} 个字段`
                    )
                  ])
                ]
              ),
              !collapsed.value
                ? h(
                    'div',
                    { class: 'group-children' },
                    children.value.length === 0
                      ? [h('div', { class: 'group-empty' }, '拖入字段到分组中')]
                      : children.value.map(child =>
                          h(FieldCardInstance as Component, {
                            key: child.id,
                            field: child
                          })
                        )
                  )
                : null
            ]
          : [
              h(
                'div',
                { class: 'field-card-body' },
                [
                  h(
                    'div',
                    { class: 'field-renderer-wrapper' },
                    [renderFieldPreview(props.field)]
                  ),
                  props.field.helpText || props.field.hint
                    ? h(
                        'div',
                        { class: 'field-hint' },
                        [
                          h(AlertCircle, { size: 12 }),
                          h('span', null, props.field.helpText || props.field.hint)
                        ]
                      )
                    : null
                ]
              )
            ]

      return h(
        'div',
        {
          class: cardClass,
          draggable: 'true',
          onClick: onCardClick,
          onMouseenter: onMouseEnter,
          onMouseleave: onMouseLeave,
          onDragstart: onDragStart,
          onDragover: onDragOver,
          onDragleave: onDragLeave,
          onDrop: onDrop
        },
        [
          h('div', { class: innerClass }, [
            h('div', { class: 'field-card-header' }, [
              h(
                'div',
                {
                  class: 'field-card-drag-handle',
                  onMousedown: onHandleMouseDown
                },
                [h(GripVertical, { size: 16 })]
              ),
              h('div', { class: 'field-card-title' }, [
                h('span', { class: 'field-label-text' }, props.field.label),
                h('span', { class: 'field-name-text' }, `(${fieldName.value})`),
                required.value
                  ? h('span', { class: 'required-mark' }, '*')
                  : null
              ]),
              showActions
                ? h('div', { class: 'field-card-actions' }, [
                    h(
                      'button',
                      {
                        class: 'field-action-btn',
                        title: '复制',
                        onClick: onDuplicate,
                        type: 'button'
                      },
                      [h(Copy, { size: 14 })]
                    ),
                    h(
                      'button',
                      {
                        class: 'field-action-btn',
                        title: '上移',
                        onClick: onMoveUp,
                        type: 'button'
                      },
                      [h(ArrowUp, { size: 14 })]
                    ),
                    h(
                      'button',
                      {
                        class: 'field-action-btn',
                        title: '下移',
                        onClick: onMoveDown,
                        type: 'button'
                      },
                      [h(ArrowDown, { size: 14 })]
                    ),
                    h(
                      'button',
                      {
                        class: 'field-action-btn danger',
                        title: '删除',
                        onClick: onRemove,
                        type: 'button'
                      },
                      [h(Trash2, { size: 14 })]
                    )
                  ])
                : null
            ]),
            ...cardBody
          ])
        ]
      )
    }
  }
})

// 用显式类型的 ref 避免自引用 any 问题
const recursiveFieldCardComp = shallowRef<Component>(markRaw(FieldCardInstance as Component))
</script>

<template>
  <div
    class="canvas-container"
    @dragover="handleCanvasDragOver"
    @drop="handleCanvasDrop"
  >
    <template v-if="loading">
      <div class="canvas-loading">
        <Skeleton :lines="8" :show-inputs="4" :show-boxes="2" />
      </div>
    </template>

    <template v-else-if="effectiveFields.length === 0">
      <div class="canvas-empty">
        <div class="empty-icon">📋</div>
        <div class="empty-title">画布为空</div>
        <div class="empty-desc">从左侧字段库拖入字段开始设计表单</div>
      </div>
    </template>

    <template v-else>
      <div class="canvas-fields">
        <component
          v-for="field in effectiveFields"
          :key="field.id"
          :is="recursiveFieldCardComp"
          :field="field"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.canvas-container {
  flex: 1;
  padding: 24px;
  background: var(--canvas-bg, #f8fafc);
  min-height: 100%;
  overflow-y: auto;
}

.canvas-loading {
  max-width: 800px;
  margin: 0 auto;
}

.canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  border: 2px dashed var(--border-color, #e2e8f0);
  border-radius: 12px;
  background: var(--empty-bg, #ffffff);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: var(--text-muted, #64748b);
}

.canvas-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 800px;
  margin: 0 auto;
}

.field-wrapper {
  position: relative;
  transition: all 0.2s ease;
}

.field-wrapper.drag-over-before::before,
.field-wrapper.drag-over-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary-color, #3b82f6);
  border-radius: 2px;
  z-index: 10;
}

.field-wrapper.drag-over-before::before {
  top: -2px;
}

.field-wrapper.drag-over-after::after {
  bottom: -2px;
}

.field-wrapper.drag-over-inside > .field-card {
  border-color: var(--primary-color, #3b82f6) !important;
  background: rgba(59, 130, 246, 0.05);
}

.field-card {
  background: var(--field-bg, #ffffff);
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 16px;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.field-card:hover {
  border-color: var(--border-hover, #cbd5e1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.field-wrapper.is-selected .field-card {
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08);
}

.field-card.is-group {
  border-left: 4px solid var(--group-color, #8b5cf6);
}

.field-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.field-card-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-muted, #94a3b8);
  cursor: grab;
  border-radius: 4px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.field-card-drag-handle:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #475569);
}

.field-card-drag-handle:active {
  cursor: grabbing;
}

.field-card-title {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.field-label-text {
  flex-shrink: 0;
}

.field-name-text {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.required-mark {
  color: var(--error-color, #ef4444);
  font-weight: 600;
  flex-shrink: 0;
}

.field-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.field-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted, #64748b);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.field-action-btn:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.field-action-btn.danger:hover {
  background: var(--error-bg, #fef2f2);
  color: var(--error-color, #ef4444);
}

.field-card-body {
  padding-left: 34px;
}

.field-renderer-wrapper {
  background: var(--preview-bg, #f8fafc);
  border-radius: 8px;
  padding: 12px;
}

.preview-input,
.preview-textarea,
.preview-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  background: var(--field-bg, #ffffff);
  color: var(--text-primary, #1e293b);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.preview-textarea {
  min-height: 80px;
  resize: vertical;
}

.preview-radio-group,
.preview-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.preview-radio-group.inline,
.preview-checkbox-group.inline {
  flex-direction: row;
}

.preview-radio,
.preview-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary, #1e293b);
  font-size: 14px;
  cursor: not-allowed;
}

.preview-switch {
  position: relative;
  width: 44px;
  height: 24px;
}

.preview-switch .switch-track {
  position: absolute;
  inset: 0;
  background: var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.preview-switch .switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.preview-rating {
  display: flex;
  gap: 4px;
}

.preview-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 2px dashed var(--border-color, #e2e8f0);
  border-radius: 6px;
  color: var(--text-muted, #64748b);
  font-size: 14px;
}

.preview-slider {
  padding: 8px 0;
}

.preview-slider .slider-track {
  position: relative;
  height: 6px;
  background: var(--border-color, #e2e8f0);
  border-radius: 3px;
}

.preview-slider .slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--primary-color, #3b82f6);
  border-radius: 3px;
}

.preview-slider .slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  background: var(--primary-color, #3b82f6);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.preview-cascader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  background: var(--field-bg, #ffffff);
}

.preview-cascader .placeholder {
  color: var(--text-muted, #94a3b8);
}

.preview-richtext {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
}

.richtext-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--hover-bg, #f1f5f9);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  font-weight: 600;
  color: var(--text-muted, #64748b);
}

.preview-richtext {
  display: flex;
  flex-direction: column;
}

.richtext-placeholder-icon {
  align-self: center;
  margin-top: 12px;
  color: var(--text-muted, #94a3b8);
}

.richtext-placeholder {
  align-self: center;
  padding: 12px;
  color: var(--text-muted, #94a3b8);
  font-size: 14px;
}

.preview-unknown {
  padding: 12px;
  text-align: center;
  color: var(--text-muted, #94a3b8);
  font-size: 14px;
}

.preview-datetime-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-datetime-icon {
  color: var(--text-muted, #94a3b8);
  flex-shrink: 0;
}

.field-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding-left: 4px;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--group-bg, #faf5ff);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: 34px;
}

.group-header:hover {
  background: var(--group-hover-bg, #f3e8ff);
}

.group-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--group-color, #8b5cf6);
  flex-shrink: 0;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.group-name {
  font-weight: 500;
  color: var(--group-color, #8b5cf6);
}

.group-count {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  background: var(--group-badge-bg, #ede9fe);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.group-children {
  margin-top: 12px;
  margin-left: 34px;
  padding-left: 16px;
  border-left: 2px solid var(--group-border, #e9d5ff);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-empty {
  padding: 24px;
  text-align: center;
  border: 2px dashed var(--group-border, #e9d5ff);
  border-radius: 8px;
  color: var(--text-muted, #94a3b8);
  font-size: 14px;
  background: var(--group-empty-bg, #faf5ff);
}
</style>
