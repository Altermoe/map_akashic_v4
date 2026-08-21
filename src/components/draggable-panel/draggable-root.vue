<script setup lang="ts">
import { computed, ref } from 'vue'
import { provideDraggableContext } from './draggable-context'
import { useDraggableResizable } from './use-draggable-resizable'

export interface DraggableRootProps {
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
  /** 是否打开（受控） */
  open?: boolean
  /** 默认是否打开（非受控） */
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<DraggableRootProps>(), {
  initialWidth: 320,
  initialHeight: 480,
  initialX: 24,
  initialY: 24,
  minWidth: 200,
  minHeight: 200,
  constrainToViewport: true,
  innerDebounceMs: 150,
  title: '面板',
  defaultOpen: true,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// 标题栏高度常量（与 draggable-controller 保持一致）
const HEADER_HEIGHT = 36

// 面板根 DOM 引用（由 Portal 组件挂载时赋值）
const panelRef = ref<HTMLElement | null>(null)

// 内部 open 状态（非受控模式使用）
const innerOpen = ref(props.defaultOpen)

// 计算 open 状态：受控模式优先使用 props.open，否则使用内部状态
const open = computed({
  get() {
    return props.open !== undefined ? props.open : innerOpen.value
  },
  set(val: boolean) {
    innerOpen.value = val
    emit('update:open', val)
  },
})

// 标题文字（响应式
const titleRef = computed(() => props.title)

// 标题唯一 id（用于 aria 关联）
const titleId = `draggable-title-${Math.random().toString(36).slice(2, 9)}`

// 核心拖拽缩放逻辑
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
  panelRef,
})

// 关闭面板
const close = () => {
  open.value = false
}

// 切换打开状态
const onOpenChange = (val: boolean) => {
  open.value = val
}

// 提供上下文
provideDraggableContext({
  panelRef,
  outerX,
  outerY,
  outerWidth,
  outerHeight,
  innerWidth,
  innerHeight,
  isInteracting,
  headerHeight: HEADER_HEIGHT,
  onHandleDown,
  open,
  onOpenChange,
  close,
  title: titleRef,
  titleId,
})
</script>

<template>
  <!-- 根组件不渲染 DOM，仅提供上下文和 slot -->
  <slot :open="open" :close="close" />
</template>
