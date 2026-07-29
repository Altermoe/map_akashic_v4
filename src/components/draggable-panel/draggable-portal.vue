<script setup lang="ts">
import { computed, watch } from 'vue'
import { useDraggableContext } from './draggable-context'

const { panelRef, outerX, outerY, outerWidth, outerHeight, isInteracting, open, titleId } =
  useDraggableContext()

// 模板中用于绑定 ref 的元素引用
const portalEl = ref<HTMLElement | null>(null)

// 将模板 ref 同步到 context 的 panelRef
watch(
  portalEl,
  (el) => {
    panelRef.value = el
  },
  { immediate: true },
)

// 外层容器样式（即时响应）
const portalStyle = computed(() => ({
  transform: `translate(${outerX.value}px, ${outerY.value}px)`,
  width: `${outerWidth.value}px`,
  height: `${outerHeight.value}px`,
}))
</script>

<template>
  <!-- 外层容器：位置 + 尺寸 即时响应，使用 transform 提升性能 -->
  <div
    v-show="open"
    ref="portalEl"
    class="draggable-portal backdrop-blur"
    :class="{ 'is-interacting': isInteracting }"
    :style="portalStyle"
    role="dialog"
    :aria-labelledby="titleId"
  >
    <slot />
  </div>
</template>

<style scoped>
.draggable-portal {
  --panel-radius: 8px;
  --panel-bg: #00000020;
  --panel-border: var(--gl-4);
  --panel-shadow: 0 4px 16px oklch(0 0 0 / 0.15);

  position: absolute;
  left: 0;
  top: 0;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--panel-radius);
  box-shadow: var(--panel-shadow);
  overflow: hidden;
  user-select: none;
  contain: layout style;
}

.draggable-portal.is-interacting {
  /* 交互时禁用过渡，跟手更灵敏 */
  transition: none;
  /* 仅在交互期间开启 will-change，提示浏览器启用 GPU 加速 */
  will-change: transform, width, height;
}
</style>
