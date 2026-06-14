<script setup lang="ts">
defineOptions({
  name: 'FieldPalette'
})

import { ref } from 'vue'
import type { FieldType } from '@/types'
import { useFormStore } from '@/stores/formStore'
import { createDefaultField } from '@/utils/schemaConverter'
import {
  Type,
  Hash,
  AlignLeft,
  List,
  CircleDot,
  CheckSquare,
  SlidersHorizontal,
  ToggleLeft,
  Calendar,
  Clock,
  Star,
  Upload,
  GitBranch,
  FileText,
  LayoutGrid
} from 'lucide-vue-next'

const store = useFormStore()

interface FieldCategory {
  title: string
  fields: {
    type: FieldType
    label: string
    icon: typeof Type
  }[]
}

const categories: FieldCategory[] = [
  {
    title: '基础组件',
    fields: [
      { type: 'input', label: '文本', icon: Type },
      { type: 'number', label: '数字', icon: Hash },
      { type: 'textarea', label: '多行文本', icon: AlignLeft },
      { type: 'select', label: '下拉选择', icon: List },
      { type: 'radio', label: '单选', icon: CircleDot },
      { type: 'checkbox', label: '多选', icon: CheckSquare },
      { type: 'slider', label: '滑块', icon: SlidersHorizontal }
    ]
  },
  {
    title: '高级组件',
    fields: [
      { type: 'switch', label: '开关', icon: ToggleLeft },
      { type: 'date', label: '日期', icon: Calendar },
      { type: 'time', label: '时间', icon: Clock },
      { type: 'rating', label: '评分', icon: Star },
      { type: 'upload', label: '上传', icon: Upload },
      { type: 'cascader', label: '级联', icon: GitBranch },
      { type: 'richtext', label: '富文本', icon: FileText }
    ]
  },
  {
    title: '布局组件',
    fields: [
      { type: 'group', label: '分组', icon: LayoutGrid }
    ]
  }
]

const dragImageRef = ref<HTMLDivElement | null>(null)
const dragTypeRef = ref<FieldType | null>(null)

function handleDragStart(e: DragEvent, type: FieldType) {
  if (!e.dataTransfer) return
  dragTypeRef.value = type
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('application/x-field-type', type)

  if (dragImageRef.value && dragTypeRef.value) {
    e.dataTransfer.setDragImage(dragImageRef.value, 16, 16)
  }
}

function handleDragEnd() {
  dragTypeRef.value = null
}

function handleClick(type: FieldType) {
  const field = createDefaultField(type, store.fields)
  store.addField(field)
}

function handleKeydown(e: KeyboardEvent, type: FieldType) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleClick(type)
  }
}
</script>

<template>
  <div class="field-palette">
    <div ref="dragImageRef" class="drag-image" aria-hidden="true">
      <LayoutGrid :size="16" />
      <span>{{ dragTypeRef ? categories.flatMap(c => c.fields).find(f => f.type === dragTypeRef)?.label : '添加字段' }}</span>
    </div>

    <div v-for="category in categories" :key="category.title" class="field-category">
      <h3 class="category-title">{{ category.title }}</h3>
      <div class="field-grid">
        <div
          v-for="field in category.fields"
          :key="field.type"
          class="field-card"
          tabindex="0"
          draggable="true"
          @dragstart="handleDragStart($event, field.type)"
          @dragend="handleDragEnd"
          @click="handleClick(field.type)"
          @keydown="handleKeydown($event, field.type)"
        >
          <component :is="field.icon" :size="20" class="field-icon" />
          <span class="field-label">{{ field.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field-palette {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  background: #fafafa;
  border-right: 1px solid #e8e8e8;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.field-category {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  padding: 0 4px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.field-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.field-card:hover,
.field-card:focus {
  border-color: #1677ff;
  background: #e6f4ff;
  outline: none;
}

.field-card:focus-visible {
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2);
}

.field-card:active {
  transform: scale(0.98);
}

.field-icon {
  color: #666;
  flex-shrink: 0;
}

.field-card:hover .field-icon,
.field-card:focus .field-icon {
  color: #1677ff;
}

.field-label {
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-card:hover .field-label,
.field-card:focus .field-label {
  color: #1677ff;
}

.drag-image {
  position: fixed;
  left: -9999px;
  top: -9999px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #1677ff;
  color: #fff;
  border-radius: 4px;
  font-size: 14px;
  pointer-events: none;
  z-index: 9999;
}
</style>
