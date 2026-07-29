<script setup lang="ts">
import { computed } from 'vue'
import { useDraggableContext } from './draggable-context'
import type { ResizeDirection } from './use-draggable-resizable'

const { innerWidth, innerHeight, isInteracting, onHandleDown, headerHeight } = useDraggableContext()

// 八向缩放句柄配置
const resizeHandles: { dir: ResizeDirection; posClass: string; cursor: string }[] = [
  { dir: 'n', posClass: 'draggable-content__handle--n', cursor: 'ns-resize' },
  { dir: 's', posClass: 'draggable-content__handle--s', cursor: 'ns-resize' },
  { dir: 'e', posClass: 'draggable-content__handle--e', cursor: 'ew-resize' },
  { dir: 'w', posClass: 'draggable-content__handle--w', cursor: 'ew-resize' },
  { dir: 'nw', posClass: 'draggable-content__handle--nw', cursor: 'nwse-resize' },
  { dir: 'ne', posClass: 'draggable-content__handle--ne', cursor: 'nesw-resize' },
  { dir: 'sw', posClass: 'draggable-content__handle--sw', cursor: 'nesw-resize' },
  { dir: 'se', posClass: 'draggable-content__handle--se', cursor: 'nwse-resize' },
]

// 内容区样式（防抖后更新）
const contentStyle = computed(() => ({
  width: `${innerWidth.value}px`,
  height: `${innerHeight.value - headerHeight}px`,
}))
</script>

<template>
  <!-- 内部内容区：仅在交互结束后更新尺寸 -->
  <div class="draggable-content" :style="contentStyle">
    <slot />
  </div>

  <!-- 八向缩放句柄 -->
  <div
    v-for="h in resizeHandles"
    :key="h.dir"
    class="draggable-content__handle"
    :class="[h.posClass, { 'is-active': isInteracting }]"
    :style="{ cursor: h.cursor }"
    @pointerdown="onHandleDown(h.dir, $event)"
  />
</template>

<style scoped>
.draggable-content {
  position: absolute;
  left: 0;
  top: var(--header-height, 36px);
  overflow: auto;
  box-sizing: border-box;
  color: var(--gl-7);
  font-size: 12.5px;
  /* 尺寸由 contentStyle 控制（防抖后更新），避免内容区高频重排 */
}

/* ---------- 八向缩放句柄 ---------- */
.draggable-content__handle {
  --handle-size: 8px;
  --handle-color: var(--color-brand-6);

  position: absolute;
  z-index: 10;
  opacity: 0;
  background: transparent;
  transition:
    opacity 120ms ease,
    background-color 120ms ease;
}

/* hover 时显示（通过边框/背景体现） */
.draggable-content__handle:hover,
.draggable-content__handle.is-active {
  opacity: 1;
  background: var(--handle-color);
}

/* 上下边 */
.draggable-content__handle--n,
.draggable-content__handle--s {
  left: var(--handle-size);
  right: var(--handle-size);
  height: var(--handle-size);
  border-radius: 2px;
}
.draggable-content__handle--n {
  top: calc(-1 * var(--handle-size) / 2);
}
.draggable-content__handle--s {
  bottom: calc(-1 * var(--handle-size) / 2);
}

/* 左右边 */
.draggable-content__handle--e,
.draggable-content__handle--w {
  top: var(--handle-size);
  bottom: var(--handle-size);
  width: var(--handle-size);
  border-radius: 2px;
}
.draggable-content__handle--e {
  right: calc(-1 * var(--handle-size) / 2);
}
.draggable-content__handle--w {
  left: calc(-1 * var(--handle-size) / 2);
}

/* 四个角 */
.draggable-content__handle--nw,
.draggable-content__handle--ne,
.draggable-content__handle--sw,
.draggable-content__handle--se {
  width: calc(var(--handle-size) * 2);
  height: calc(var(--handle-size) * 2);
  border-radius: 3px;
}
.draggable-content__handle--nw {
  top: calc(-1 * var(--handle-size));
  left: calc(-1 * var(--handle-size));
}
.draggable-content__handle--ne {
  top: calc(-1 * var(--handle-size));
  right: calc(-1 * var(--handle-size));
}
.draggable-content__handle--sw {
  bottom: calc(-1 * var(--handle-size));
  left: calc(-1 * var(--handle-size));
}
.draggable-content__handle--se {
  bottom: calc(-1 * var(--handle-size));
  right: calc(-1 * var(--handle-size));
}

/* 角上的句柄始终可见一个小角标（WinUI 风格的视觉提示） */
.draggable-content__handle--nw::after,
.draggable-content__handle--ne::after,
.draggable-content__handle--sw::after,
.draggable-content__handle--se::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border: 1.5px solid var(--gl-4);
  border-radius: 50%;
  opacity: 0.6;
  transition:
    opacity 120ms ease,
    border-color 120ms ease,
    transform 120ms ease;
}
.draggable-content__handle--nw::after {
  top: 5px;
  left: 5px;
}
.draggable-content__handle--ne::after {
  top: 5px;
  right: 5px;
}
.draggable-content__handle--sw::after {
  bottom: 5px;
  left: 5px;
}
.draggable-content__handle--se::after {
  bottom: 5px;
  right: 5px;
}

.draggable-content__handle:hover::after,
.draggable-content__handle.is-active::after {
  opacity: 1;
  border-color: var(--handle-color);
  transform: scale(1.2);
}
</style>
