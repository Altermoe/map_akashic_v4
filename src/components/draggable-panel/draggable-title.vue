<script setup lang="ts">
import { useDraggableContext } from './draggable-context'

const { title } = useDraggableContext()
</script>

<template>
  <span class="draggable-title">
    <slot>{{ title }}</slot>
  </span>
</template>

<style scoped>
.draggable-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gl-8);
  letter-spacing: 0.2px;
}
</style>
