<script setup lang="ts">
import { useDraggableContext } from './draggable-context'

const { onHandleDown, titleId } = useDraggableContext()
</script>

<template>
  <!-- 标题栏（拖拽区） -->
  <div class="draggable-controller" :id="titleId" @pointerdown="onHandleDown('move', $event)">
    <slot />
  </div>
</template>

<style scoped>
.draggable-controller {
  --header-height: 36px;
  --header-bg: var(--gl-2);
  --header-border: var(--gl-3);

  height: var(--header-height);
  padding: 0 12px;
  display: flex;
  align-items: center;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  cursor: grab;
  transition: background-color 120ms ease;
}

.draggable-controller:active {
  cursor: grabbing;
}
</style>
