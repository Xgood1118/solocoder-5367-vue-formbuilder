<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  FormInput, FileJson, Download, Undo2, Redo2,
  Trash2, Eye, Rocket, Save
} from 'lucide-vue-next'
import { useFormStore } from '@/stores/formStore'
import {
  formSchemaToJSONSchema,
  downloadJSONSchema,
  migrateSchema,
  CURRENT_VERSION
} from '@/utils/schemaConverter'
import type { SchemaField, ToastPayload } from '@/types'
import FieldPalette from '@/components/FieldPalette.vue'
import Canvas from '@/components/Canvas.vue'
import PropertyPanel from '@/components/PropertyPanel.vue'
import Toast from '@/components/Toast.vue'
import Skeleton from '@/components/Skeleton.vue'
import PreviewModal from '@/components/PreviewModal.vue'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItemLocal {
  id: number
  type: ToastType
  message: string
  duration: number
  leaving: boolean
}

const store = useFormStore()

const STORAGE_KEY = 'vue-formbuilder-saved'
const DEBOUNCE_DELAY = 500

const loading = ref(true)
const showPreviewModal = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const canUndo = computed(() => store.undoStack.length > 0)
const canRedo = computed(() => store.redoStack.length > 0)

const toasts = computed<ToastItemLocal[]>(() =>
  store.toasts.map((t: ToastPayload, idx: number) => ({
    id: typeof t.id === 'number' ? t.id : idx,
    type: t.type,
    message: t.message,
    duration: t.duration || 3000,
    leaving: false
  }))
)

const fieldsCount = computed(() => {
  const countFields = (fields: SchemaField[]): number => {
    let count = 0
    const walk = (arr: SchemaField[]) => {
      arr.forEach(f => {
        if (f.type === 'group' && f.children) {
          walk(f.children)
        } else {
          count++
        }
      })
    }
    walk(fields)
    return count
  }
  return countFields(store.schema.fields)
})

const isInputFocused = (): boolean => {
  const activeEl = document.activeElement
  if (!activeEl) return false
  const tagName = activeEl.tagName
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    (activeEl as HTMLElement).isContentEditable === true
  )
}

const debouncedPersist = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    try {
      const data = {
        schema: store.schema,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[App] persist failed:', e)
    }
  }, DEBOUNCE_DELAY)
}

const restoreFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as { schema?: unknown; savedAt?: string }
      if (data.schema) {
        const { schema: migratedSchema, warnings } = migrateSchema(data.schema, CURRENT_VERSION)
        store.$patch({
          schema: migratedSchema,
          selectedFieldId: null,
          undoStack: [],
          redoStack: []
        } as unknown as Parameters<typeof store.$patch>[0])
        if (warnings.length > 0) {
          store.showToast({
            type: 'warning',
            message: `已恢复本地数据（${warnings.length} 条迁移警告）`
          })
        } else {
          store.showToast({
            type: 'success',
            message: '已从本地存储恢复表单'
          })
        }
        return true
      }
    }
  } catch (e) {
    console.error('[App] restore failed:', e)
  }
  return false
}

const exportJSON = () => {
  try {
    const result = formSchemaToJSONSchema(store.schema)
    downloadJSONSchema(result)
    store.showToast({
      type: 'success',
      message: `已导出 ${fieldsCount.value} 个字段的 JSON Schema`
    })
  } catch (e) {
    console.error('[App] export failed:', e)
    store.showToast({
      type: 'error',
      message: '导出失败'
    })
  }
}

const triggerImport = () => {
  fileInputRef.value?.click()
}

const readJSONFile = (file: File): Promise<Record<string, unknown>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string
        resolve(JSON.parse(content))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

const handleImport = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const data = await readJSONFile(file)
    const { schema: migratedSchema, warnings } = migrateSchema(data, CURRENT_VERSION)

    store.$patch({
      schema: migratedSchema,
      selectedFieldId: null,
      undoStack: [],
      redoStack: []
    } as unknown as Parameters<typeof store.$patch>[0])

    if (warnings.length > 0) {
      store.showToast({
        type: 'warning',
        message: `已导入并迁移（${warnings.length} 条警告）`
      })
    } else {
      store.showToast({
        type: 'success',
        message: '已成功导入 JSON 文件'
      })
    }
  } catch (err) {
    console.error('[App] import failed:', err)
    store.showToast({
      type: 'error',
      message: '导入失败: JSON 格式错误'
    })
  } finally {
    if (input) input.value = ''
  }
}

const saveForm = () => {
  try {
    const data = {
      schema: store.schema,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    store.showToast({
      type: 'success',
      message: '表单已保存到本地存储'
    })
  } catch (e) {
    console.error('[App] save failed:', e)
    store.showToast({
      type: 'error',
      message: '保存失败'
    })
  }
}

const openPreview = () => {
  showPreviewModal.value = true
  store.selectField(null)
}

const closePreview = () => {
  showPreviewModal.value = false
}

const publishForm = () => {
  store.changeStatus('published')
  store.showToast({
    type: 'success',
    message: `表单已发布！共 ${fieldsCount.value} 个字段`
  })
}

const clearCanvas = () => {
  if (store.schema.fields.length === 0) {
    store.showToast({
      type: 'info',
      message: '画布已经是空的了'
    })
    return
  }
  if (confirm('确定要清空画布吗？此操作可通过撤销恢复。')) {
    store.resetSchema()
    store.showToast({
      type: 'success',
      message: '已清空画布'
    })
  }
}

const handleDismissToast = (id: number) => {
  const target = store.toasts.find((t: ToastPayload, idx: number) =>
    typeof t.id === 'number' ? t.id === id : idx === id
  )
  if (target?.id) {
    store.dismissToast(String(target.id))
  }
}

const onKeyDown = (e: KeyboardEvent) => {
  const isCtrl = e.ctrlKey || e.metaKey
  const focused = isInputFocused()

  if (isCtrl) {
    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault()
        saveForm()
        break
      case 'p':
        e.preventDefault()
        openPreview()
        break
      case 'z':
        e.preventDefault()
        if (e.shiftKey) {
          store.redo()
        } else {
          store.undo()
        }
        break
      case 'y':
        e.preventDefault()
        store.redo()
        break
    }
  } else if (!focused) {
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (store.selectedFieldId) {
          e.preventDefault()
          store.removeField(store.selectedFieldId)
        }
        break
      case 'ArrowUp':
        if (store.selectedFieldId && !e.shiftKey) {
          e.preventDefault()
          store.reorderField(store.selectedFieldId, 'up')
        }
        break
      case 'ArrowDown':
        if (store.selectedFieldId && !e.shiftKey) {
          e.preventDefault()
          store.reorderField(store.selectedFieldId, 'down')
        }
        break
      case 'Escape':
        store.selectField(null)
        break
    }
  }
}

watch(
  () => store.schema,
  () => {
    debouncedPersist()
  },
  { deep: true }
)

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)

  nextTick(() => {
    store.initFromStorage()
    restoreFromStorage()

    setTimeout(() => {
      loading.value = false
    }, 500)
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="app-header-left">
        <FormInput :size="24" style="color: var(--primary-color);" />
        <span class="app-header-title">Vue FormBuilder</span>
        <span class="kbd">v{{ CURRENT_VERSION }}</span>
      </div>
      <div class="app-header-right">
        <button
          class="btn btn-outline btn-sm"
          title="导入JSON"
          @click="triggerImport"
        >
          <FileJson :size="16" />
          导入JSON
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          style="display: none"
          @change="handleImport"
        />
        <button
          class="btn btn-outline btn-sm"
          title="导出JSON"
          @click="exportJSON"
        >
          <Download :size="16" />
          导出JSON
        </button>
        <div class="divider" />
        <button
          class="btn btn-outline btn-sm"
          title="撤销 (Ctrl+Z)"
          :disabled="!canUndo"
          @click="store.undo"
        >
          <Undo2 :size="16" />
        </button>
        <button
          class="btn btn-outline btn-sm"
          title="重做 (Ctrl+Y)"
          :disabled="!canRedo"
          @click="store.redo"
        >
          <Redo2 :size="16" />
        </button>
      </div>
    </header>

    <main class="app-main">
      <FieldPalette style="width: 280px; flex-shrink: 0;" />
      <Canvas :is-root="true" style="flex: 1;" />
      <PropertyPanel style="width: 280px; flex-shrink: 0;" />
    </main>

    <footer class="app-footer">
      <div class="app-footer-left">
        <span class="footer-stats">
          共 {{ fieldsCount }} 个字段
        </span>
      </div>
      <div class="app-footer-right">
        <button
          class="btn btn-outline btn-sm"
          title="清空画布"
          @click="clearCanvas"
        >
          <Trash2 :size="16" />
          清空
        </button>
        <button
          class="btn btn-outline btn-sm"
          title="预览 (Ctrl+P)"
          @click="openPreview"
        >
          <Eye :size="16" />
          预览
        </button>
        <button
          class="btn btn-primary btn-sm"
          title="发布表单"
          @click="publishForm"
        >
          <Rocket :size="16" />
          发布
        </button>
        <button
          class="btn btn-success btn-sm"
          title="保存 (Ctrl+S)"
          @click="saveForm"
        >
          <Save :size="16" />
          保存
        </button>
      </div>
    </footer>

    <Skeleton v-if="loading" :lines="10" :show-inputs="5" :show-boxes="2" />

    <Toast
      :toasts="toasts"
      @remove="handleDismissToast"
    />

    <PreviewModal
      v-if="showPreviewModal"
      :schema="store.schema.fields as never[]"
      :initial-form-data="{}"
      @close="closePreview"
      @toast="(evt) => store.showToast(evt)"
    />
  </div>
</template>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.app-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.app-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kbd {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.divider {
  margin: 0 8px;
  width: 1px;
  height: 20px;
  background: var(--border-color);
}

.app-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.app-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-stats {
  font-size: 13px;
  color: var(--text-muted);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-outline {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-color-hover, #4f46e5);
}

.btn-success {
  background: var(--success-color, #10b981);
  color: white;
}

.btn-success:hover {
  background: var(--success-color-hover, #059669);
}
</style>
