<script setup lang="ts">
import { computed } from 'vue'
import DraggableContent from './draggable-content.vue'
import DraggableController from './draggable-controller.vue'
import DraggablePortal from './draggable-portal.vue'
import DraggableRoot from './draggable-root.vue'
import DraggableTitle from './draggable-title.vue'

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

// 透传给 DraggableRoot 的 props
const rootProps = computed(() => ({
  initialWidth: props.initialWidth,
  initialHeight: props.initialHeight,
  initialX: props.initialX,
  initialY: props.initialY,
  minWidth: props.minWidth,
  minHeight: props.minHeight,
  constrainToViewport: props.constrainToViewport,
  innerDebounceMs: props.innerDebounceMs,
  title: props.title,
}))
</script>

<template>
  <!-- 预置组合：使用子组件拼装，保持与原单片组件完全一致的 API 和视觉效果 -->
  <DraggableRoot v-bind="rootProps" open>
    <DraggablePortal>
      <DraggableController>
        <slot name="header">
          <DraggableTitle>{{ title }}</DraggableTitle>
        </slot>
      </DraggableController>
      <DraggableContent>
        <slot />
      </DraggableContent>
    </DraggablePortal>
  </DraggableRoot>
</template>
