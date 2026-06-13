<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  X, ChevronLeft, ChevronRight, Save, FolderDown,
  Check, Trash2, Eye, FileJson, Send
} from 'lucide-vue-next'
import FieldRenderer from './FieldRenderer.vue'
import type { SchemaField } from './FieldRenderer.vue'

interface ToastEvent {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

interface PresetItem {
  id: string
  name: string
  createdAt: string
  schema: SchemaField[]
}

interface StepPage {
  title: string
  fields: SchemaField[]
}

const PRESET_KEY = 'vue-formbuilder-presets'

const props = defineProps<{
  schema: SchemaField[]
  initialFormData: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toast', evt: ToastEvent): void
}>()

const fieldRendererRef = ref<InstanceType<typeof FieldRenderer> | null>(null)
const formData = ref<Record<string, unknown>>({ ...props.initialFormData })
const currentStep = ref(0)
const presetModalOpen = ref(false)
const savePresetName = ref('')
const presets = ref<PresetItem[]>([])

const flattenFields = (fields: SchemaField[]): SchemaField[] => {
  const result: SchemaField[] = []
  const walk = (arr: SchemaField[]) => {
    arr.forEach(f => {
      if (f.type === 'group' && f.children) {
        walk(f.children)
      } else {
        result.push(f)
      }
    })
  }
  walk(fields)
  return result
}

const flatFields = computed(() => flattenFields(props.schema))

const steps = computed<StepPage[]>(() => {
  const result: StepPage[] = []
  let standaloneFields: SchemaField[] = []

  props.schema.forEach(f => {
    if (f.type === 'group' && f.children) {
      if (standaloneFields.length > 0) {
        result.push({ title: '基本信息', fields: standaloneFields })
        standaloneFields = []
      }
      result.push({ title: f.label || `步骤 ${result.length + 1}`, fields: f.children })
    } else {
      standaloneFields.push(f)
    }
  })

  if (standaloneFields.length > 0) {
    if (result.length === 0) {
      result.push({ title: '表单填写', fields: standaloneFields })
    } else {
      result.push({ title: '其他信息', fields: standaloneFields })
    }
  }

  if (result.length === 0) {
    result.push({ title: '表单', fields: [] })
  }

  return result
})

const totalSteps = computed(() => steps.value.length)
const isLastStep = computed(() => currentStep.value >= totalSteps.value - 1)
const isFirstStep = computed(() => currentStep.value <= 0)

const currentStepFields = computed(() => steps.value[currentStep.value]?.fields || [])

const goToPrevStep = () => {
  if (!isFirstStep.value) {
    currentStep.value--
  }
}

const goToNextStep = () => {
  if (fieldRendererRef.value) {
    const allFields = flatFields.value
    const currentFieldKeys = new Set(currentStepFields.value.map(f => f.field))
    let stepValid = true
    allFields.forEach(f => {
      if (currentFieldKeys.has(f.field)) {
        const valid = fieldRendererRef.value?.errors?.[f.field] === '' ||
          !fieldRendererRef.value?.errors?.[f.field]
        if (!valid) stepValid = false
      }
    })
    if (!stepValid) {
      emit('toast', {
        type: 'warning',
        message: '请先完成当前步骤的必填项',
        duration: 3000
      })
      return
    }
  }
  if (!isLastStep.value) {
    currentStep.value++
  }
}

const goToStep = (idx: number) => {
  if (idx >= 0 && idx < totalSteps.value) {
    currentStep.value = idx
  }
}

const handleSubmit = () => {
  if (fieldRendererRef.value) {
    const valid = fieldRendererRef.value.validateAll()
    if (!valid) {
      emit('toast', {
        type: 'error',
        message: '表单校验未通过，请检查红色提示字段',
        duration: 4000
      })
      return
    }
  }
  const jsonStr = JSON.stringify(formData.value, null, 2)
  emit('toast', {
    type: 'success',
    message: `提交成功！数据: ${jsonStr.slice(0, 100)}${jsonStr.length > 100 ? '...' : ''}`,
    duration: 6000
  })
  try {
    navigator.clipboard?.writeText(jsonStr).catch(() => {})
  } catch {}
}

const closeModal = () => {
  emit('close')
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (presetModalOpen.value) {
      presetModalOpen.value = false
    } else {
      closeModal()
    }
  }
}

const loadPresets = () => {
  try {
    const raw = localStorage.getItem(PRESET_KEY)
    if (raw) {
      presets.value = JSON.parse(raw) as PresetItem[]
    }
  } catch {
    presets.value = []
  }
}

const savePresets = () => {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presets.value))
  } catch (err) {
    console.error(err)
    emit('toast', { type: 'error', message: '保存预设失败', duration: 3000 })
  }
}

const openSavePreset = () => {
  presetModalOpen.value = true
  savePresetName.value = `模板-${new Date().toLocaleString('zh-CN')}`
}

const handleSavePreset = () => {
  if (!savePresetName.value.trim()) {
    emit('toast', { type: 'warning', message: '请输入模板名称', duration: 3000 })
    return
  }
  const newPreset: PresetItem = {
    id: `preset_${Date.now()}`,
    name: savePresetName.value.trim(),
    createdAt: new Date().toISOString(),
    schema: JSON.parse(JSON.stringify(props.schema))
  }
  presets.value.push(newPreset)
  savePresets()
  presetModalOpen.value = false
  savePresetName.value = ''
  emit('toast', { type: 'success', message: '模板已保存到本地存储', duration: 3000 })
}

const handleLoadPreset = (preset: PresetItem) => {
  emit('toast', {
    type: 'info',
    message: `已加载模板: ${preset.name}。请关闭预览后画布会同步更新。`,
    duration: 4000
  })
  presetModalOpen.value = false
}

const handleDeletePreset = (presetId: string) => {
  presets.value = presets.value.filter(p => p.id !== presetId)
  savePresets()
  emit('toast', { type: 'info', message: '模板已删除', duration: 3000 })
}

const onOverlayClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
    closeModal()
  }
}

watch(() => props.schema, () => {
  currentStep.value = 0
}, { deep: true })

onMounted(() => {
  loadPresets()
  document.addEventListener('keydown', onKeyDown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click="onOverlayClick">
      <div class="modal-wrapper" @click.stop>
        <div class="modal-header">
          <div class="modal-header-left">
            <Eye :size="20" style="color: var(--primary-color);" />
            <span class="modal-title">表单预览</span>
          </div>
          <div class="modal-header-right">
            <button class="modal-header-btn" title="保存模板" @click="openSavePreset">
              <Save :size="16" />
              <span>保存模板</span>
            </button>
            <button class="modal-header-btn" title="加载模板" @click="presetModalOpen = true">
              <FolderDown :size="16" />
              <span>加载模板</span>
            </button>
            <button class="modal-close-btn" title="关闭 (Esc)" @click="closeModal">
              <X :size="20" />
            </button>
          </div>
        </div>

        <div class="modal-steps">
          <div
            v-for="(step, idx) in steps"
            :key="idx"
            :class="['modal-step-item', {
              active: idx === currentStep,
              done: idx < currentStep
            }]"
            @click="goToStep(idx)"
          >
            <div class="modal-step-dot">
              <Check v-if="idx < currentStep" :size="14" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span class="modal-step-title">{{ step.title }}</span>
            <div v-if="idx < steps.length - 1" class="modal-step-line" />
          </div>
        </div>

        <div class="modal-body">
          <div class="step-content" :key="currentStep">
            <FieldRenderer
              ref="fieldRendererRef"
              :schema="currentStepFields"
              v-model="formData"
            />
            <div v-if="currentStepFields.length === 0" class="step-empty">
              <FileJson :size="48" style="opacity: 0.3;" />
              <p>当前步骤没有字段</p>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="modal-footer-left">
            <span style="color: var(--text-muted); font-size: 13px;">
              步骤 {{ currentStep + 1 }} / {{ totalSteps }}
            </span>
          </div>
          <div class="modal-footer-right">
            <button
              class="btn btn-outline"
              :disabled="isFirstStep"
              @click="goToPrevStep"
            >
              <ChevronLeft :size="16" />
              上一步
            </button>
            <button
              v-if="!isLastStep"
              class="btn btn-primary"
              @click="goToNextStep"
            >
              下一步
              <ChevronRight :size="16" />
            </button>
            <button
              v-else
              class="btn btn-success"
              @click="handleSubmit"
            >
              <Send :size="16" />
              提交
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="presetModalOpen" class="modal-overlay preset-overlay" @click="presetModalOpen = false">
          <div class="preset-modal" @click.stop>
            <div class="preset-modal-header">
              <div class="preset-modal-title">模板管理</div>
              <button class="modal-close-btn" @click="presetModalOpen = false">
                <X :size="18" />
              </button>
            </div>

            <div class="preset-modal-tabs">
              <div class="preset-tab active">
                <FolderDown :size="14" />加载模板
              </div>
            </div>

            <div class="preset-modal-body">
              <div class="save-preset-row">
                <input
                  v-model="savePresetName"
                  type="text"
                  class="prop-input"
                  placeholder="输入新模板名称"
                  @keyup.enter="handleSavePreset"
                />
                <button class="btn btn-primary btn-sm" @click="handleSavePreset">
                  <Save :size="14" />保存当前
                </button>
              </div>

              <div class="preset-list">
                <div v-if="presets.length === 0" class="preset-empty">
                  <FolderDown :size="32" style="opacity: 0.3;" />
                  <p>暂无保存的模板</p>
                  <p style="font-size: 12px; color: var(--text-muted);">
                    可以在上方输入名称保存当前表单配置
                  </p>
                </div>
                <div
                  v-for="preset in presets"
                  :key="preset.id"
                  class="preset-item"
                >
                  <div class="preset-item-info" @click="handleLoadPreset(preset)">
                    <FileJson :size="18" style="color: var(--primary-color);" />
                    <div class="preset-item-text">
                      <div class="preset-item-name">{{ preset.name }}</div>
                      <div class="preset-item-time">
                        {{ new Date(preset.createdAt).toLocaleString('zh-CN') }}
                      </div>
                    </div>
                  </div>
                  <button
                    class="option-remove-btn"
                    title="删除模板"
                    @click.stop="handleDeletePreset(preset.id)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: modalFadeIn 0.2s ease;
}

@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-wrapper {
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  width: min(720px, 92vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalSlideUp 0.25s ease;
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-header-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-steps {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.modal-step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}

.modal-step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  border: 2px solid var(--border-color);
  transition: all 0.2s;
  flex-shrink: 0;
}

.modal-step-item.active .modal-step-dot {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.modal-step-item.done .modal-step-dot {
  background: var(--success-color, #10b981);
  color: white;
  border-color: var(--success-color, #10b981);
}

.modal-step-title {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.modal-step-item.active .modal-step-title {
  color: var(--primary-color);
  font-weight: 500;
}

.modal-step-item.done .modal-step-title {
  color: var(--text-secondary);
}

.modal-step-line {
  width: 32px;
  height: 2px;
  background: var(--border-color);
  margin: 0 8px;
}

.modal-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.step-content {
  animation: stepFadeIn 0.3s ease;
}

@keyframes stepFadeIn {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.step-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.step-empty p {
  margin-top: 12px;
  font-size: 14px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-overlay {
  z-index: 10000;
  background: rgba(0, 0, 0, 0.3);
}

.preset-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  width: min(480px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preset-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}

.preset-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.preset-modal-tabs {
  display: flex;
  padding: 0 18px;
  border-bottom: 1px solid var(--border-color);
}

.preset-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
}

.preset-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.preset-modal-body {
  padding: 16px 18px;
  overflow-y: auto;
}

.save-preset-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.save-preset-row .prop-input {
  flex: 1;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted);
}

.preset-empty p {
  margin: 8px 0 0;
  font-size: 13px;
}

.preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.15s;
}

.preset-item:hover {
  border-color: var(--primary-color);
  background: var(--bg-secondary);
}

.preset-item-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.preset-item-text {
  overflow: hidden;
}

.preset-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-item-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
