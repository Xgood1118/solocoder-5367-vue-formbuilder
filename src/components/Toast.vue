<script setup lang="ts">
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
  duration: number
  leaving: boolean
}

const props = defineProps<{
  toasts: ToastItem[]
}>()

const emit = defineEmits<{
  (e: 'remove', id: number): void
}>()

const iconComponents = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

const handleClose = (id: number) => {
  emit('remove', id)
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast-list">
        <div
          v-for="toast in props.toasts"
          :key="toast.id"
          :class="['toast-item', toast.type, { leaving: toast.leaving }]"
        >
          <component :is="iconComponents[toast.type]" class="toast-icon" />
          <span class="toast-content">{{ toast.message }}</span>
          <div class="toast-close" @click="handleClose(toast.id)">
            <X :size="16" />
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
