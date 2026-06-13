<script setup lang="ts">
withDefaults(defineProps<{
  lines?: number
  lineWidths?: ('short' | 'medium' | 'long')[]
  showInputs?: number
  showBoxes?: number
}>(), {
  lines: 3,
  lineWidths: () => ['long', 'medium', 'short'],
  showInputs: 0,
  showBoxes: 0
})
</script>

<template>
  <div class="skeleton">
    <div
      v-for="i in lines"
      :key="`line-${i}`"
      :class="['skeleton-line', lineWidths[(i - 1) % lineWidths.length]]"
    />
    <div
      v-for="i in showInputs"
      :key="`input-${i}`"
      class="skeleton-input"
    />
    <div
      v-for="i in showBoxes"
      :key="`box-${i}`"
      class="skeleton-box"
    />
  </div>
</template>
