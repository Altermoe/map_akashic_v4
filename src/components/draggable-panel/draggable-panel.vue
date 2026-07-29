<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDraggableResizable } from './use-draggable-resizable'
import type { ResizeDirection } from './use-draggable-resizable'

export interface DraggablePanelProps {
  /** 初始宽度 */
  initialWidth?: number
  /** 初始高度 */
  initialHeight?: number
  /** 初始 X 坐标 */
  initialX?: number
  /** 初始 Y 坐标 */
  initialY?: number
  /** 最小宽度 */
  minWidth?: number
  /** 最小高度 */
  minHeight?: number
  /** 是否限制在视口内 */
  constrainToViewport?: boolean
  /** 内部尺寸防抖时间(ms) */
  innerDebounceMs?: number
  /** 标题文字 */
  title?: string
}

const props = withDefaults(defineProps<DraggablePanelProps>(), {
  initialWidth: 320,
  initialHeight: 480,
  initialX: 24,
  initialY: 24,
  minWidth: 200,
  minHeight: 200,
  constrainToViewport: true,
  innerDebounceMs: 150,
  title: '面板',
})

// 面板根元素引用
const panelEl = ref<HTMLElement | null>(null)

// 八向缩放句柄配置
const resizeHandles: { dir: ResizeDirection; posClass: string; cursor: string }[] = [
  { dir: 'n', posClass: 'draggable-panel__handle--n', cursor: 'ns-resize' },
  { dir: 's', posClass: 'draggable-panel__handle--s', cursor: 'ns-resize' },
  { dir: 'e', posClass: 'draggable-panel__handle--e', cursor: 'ew-resize' },
  { dir: 'w', posClass: 'draggable-panel__handle--w', cursor: 'ew-resize' },
  { dir: 'nw', posClass: 'draggable-panel__handle--nw', cursor: 'nwse-resize' },
  { dir: 'ne', posClass: 'draggable-panel__handle--ne', cursor: 'nesw-resize' },
  { dir: 'sw', posClass: 'draggable-panel__handle--sw', cursor: 'nesw-resize' },
  { dir: 'se', posClass: 'draggable-panel__handle--se', cursor: 'nwse-resize' },
]

const {
  outerX,
  outerY,
  outerWidth,
  outerHeight,
  innerWidth,
  innerHeight,
  isInteracting,
  onHandleDown,
} = useDraggableResizable({
  initialWidth: props.initialWidth,
  initialHeight: props.initialHeight,
  initialX: props.initialX,
  initialY: props.initialY,
  minWidth: props.minWidth,
  minHeight: props.minHeight,
  constrainToViewport: props.constrainToViewport,
  innerDebounceMs: props.innerDebounceMs,
  panelRef: panelEl,
})

// 外层容器样式（即时响应）
const panelStyle = computed(() => ({
  transform: `translate(${outerX.value}px, ${outerY.value}px)`,
  width: `${outerWidth.value}px`,
  height: `${outerHeight.value}px`,
}))

// 标题栏高度常量
const HEADER_HEIGHT = 36

// 内部内容区样式（防抖后更新）
const contentStyle = computed(() => ({
  width: `${innerWidth.value}px`,
  height: `${innerHeight.value - HEADER_HEIGHT}px`,
}))
</script>

<template>
  <!-- 外层容器：位置 + 尺寸 即时响应，使用 transform 提升性能 -->
  <div
    ref="panelEl"
    class="draggable-panel"
    :class="{ 'is-interacting': isInteracting }"
    :style="panelStyle"
  >
    <!-- 标题栏（拖拽区） -->
    <div class="draggable-panel__header" @pointerdown="onHandleDown('move', $event)">
      <slot name="header">
        <span class="draggable-panel__title">{{ title }}</span>
      </slot>
    </div>

    <!-- 内部内容区：仅在交互结束后更新尺寸 -->
    <div class="draggable-panel__content bg-red-100" :style="contentStyle">
      <slot />
    </div>

    <!-- 八向缩放句柄 -->
    <div
      v-for="h in resizeHandles"
      :key="h.dir"
      class="draggable-panel__handle"
      :class="[h.posClass, { 'is-active': isInteracting }]"
      :style="{ cursor: h.cursor }"
      @pointerdown="onHandleDown(h.dir, $event)"
    />
  </div>
</template>

<style scoped>
/* ============================== WinUI 风格可拖拽面板 ============================== */
.draggable-panel {
  --panel-radius: 8px;
  --panel-bg: var(--gl-1);
  --panel-border: var(--gl-4);
  --panel-shadow: 0 4px 16px oklch(0 0 0 / 0.15);
  --header-bg: var(--gl-2);
  --header-border: var(--gl-3);
  --handle-size: 8px;
  --handle-color: var(--color-brand-6);

  position: absolute;
  left: 0;
  top: 0;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--panel-radius);
  box-shadow: var(--panel-shadow);
  overflow: hidden;
  user-select: none;
  will-change: transform, width, height;
  contain: layout style;
}

.draggable-panel.is-interacting {
  /* 交互时禁用过渡，跟手更灵敏 */
  transition: none;
}

/* ---------- 标题栏 ---------- */
.draggable-panel__header {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  cursor: grab;
  transition: background-color 120ms ease;
}

.draggable-panel__header:active {
  cursor: grabbing;
}

.draggable-panel__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gl-8);
  letter-spacing: 0.2px;
}

/* ---------- 内容区 ---------- */
.draggable-panel__content {
  position: absolute;
  left: 0;
  top: 36px;
  overflow: auto;
  box-sizing: border-box;
  color: var(--gl-7);
  font-size: 12.5px;
  /* 尺寸由 contentStyle 控制（防抖后更新），避免内容区高频重排 */
}

/* ---------- 八向缩放句柄 ---------- */
.draggable-panel__handle {
  position: absolute;
  z-index: 10;
  opacity: 0;
  background: transparent;
  transition:
    opacity 120ms ease,
    background-color 120ms ease;
}

/* hover 时显示（通过边框/背景体现） */
.draggable-panel__handle:hover,
.draggable-panel__handle.is-active {
  opacity: 1;
  background: var(--handle-color);
}

/* 上下边 */
.draggable-panel__handle--n,
.draggable-panel__handle--s {
  left: var(--handle-size);
  right: var(--handle-size);
  height: var(--handle-size);
  border-radius: 2px;
}
.draggable-panel__handle--n {
  top: calc(-1 * var(--handle-size) / 2);
}
.draggable-panel__handle--s {
  bottom: calc(-1 * var(--handle-size) / 2);
}

/* 左右边 */
.draggable-panel__handle--e,
.draggable-panel__handle--w {
  top: var(--handle-size);
  bottom: var(--handle-size);
  width: var(--handle-size);
  border-radius: 2px;
}
.draggable-panel__handle--e {
  right: calc(-1 * var(--handle-size) / 2);
}
.draggable-panel__handle--w {
  left: calc(-1 * var(--handle-size) / 2);
}

/* 四个角 */
.draggable-panel__handle--nw,
.draggable-panel__handle--ne,
.draggable-panel__handle--sw,
.draggable-panel__handle--se {
  width: calc(var(--handle-size) * 2);
  height: calc(var(--handle-size) * 2);
  border-radius: 3px;
}
.draggable-panel__handle--nw {
  top: calc(-1 * var(--handle-size));
  left: calc(-1 * var(--handle-size));
}
.draggable-panel__handle--ne {
  top: calc(-1 * var(--handle-size));
  right: calc(-1 * var(--handle-size));
}
.draggable-panel__handle--sw {
  bottom: calc(-1 * var(--handle-size));
  left: calc(-1 * var(--handle-size));
}
.draggable-panel__handle--se {
  bottom: calc(-1 * var(--handle-size));
  right: calc(-1 * var(--handle-size));
}

/* 角上的句柄始终可见一个小角标（WinUI 风格的视觉提示） */
.draggable-panel__handle--nw::after,
.draggable-panel__handle--ne::after,
.draggable-panel__handle--sw::after,
.draggable-panel__handle--se::after {
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
.draggable-panel__handle--nw::after {
  top: 5px;
  left: 5px;
}
.draggable-panel__handle--ne::after {
  top: 5px;
  right: 5px;
}
.draggable-panel__handle--sw::after {
  bottom: 5px;
  left: 5px;
}
.draggable-panel__handle--se::after {
  bottom: 5px;
  right: 5px;
}

.draggable-panel__handle:hover::after,
.draggable-panel__handle.is-active::after {
  opacity: 1;
  border-color: var(--handle-color);
  transform: scale(1.2);
}
</style>
