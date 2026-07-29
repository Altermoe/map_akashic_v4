<script setup lang="ts">
import { useDraggableContext } from './draggable-context'

defineProps<{
  /** 无障碍标签 */
  ariaLabel?: string
}>()

const { close } = useDraggableContext()
</script>

<template>
  <button
    class="draggable-close"
    type="button"
    :aria-label="ariaLabel || '关闭'"
    @click="close"
  >
    <slot>
      <!-- 默认 × 图标 -->
      <svg viewBox="0 0 16 16" class="draggable-close__icon" aria-hidden="true">
        <path
          d="M4 4L12 12M12 4L4 12"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </slot>
  </button>
</template>

<style scoped>
.draggable-close {
  --close-size: 24px;
  --close-bg-hover: var(--gl-3);
  --close-color: var(--gl-6);
  --close-color-hover: var(--gl-8);

  margin-left: auto;
  width: var(--close-size);
  height: var(--close-size);
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--close-color);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.draggable-close:hover {
  background: var(--close-bg-hover);
  color: var(--close-color-hover);
}

.draggable-close:active {
  background: var(--gl-4);
}

.draggable-close__icon {
  width: 14px;
  height: 14px;
}
</style>
