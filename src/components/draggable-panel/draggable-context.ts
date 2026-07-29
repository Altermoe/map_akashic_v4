import type { InjectionKey, Ref } from 'vue'
import { inject, provide } from 'vue'
import type { ResizeDirection } from './use-draggable-resizable'

/**
 * Draggable 复合组件上下文接口
 *
 * 由 DraggableRoot provide，所有子组件 inject 消费。
 */
export interface DraggableContext {
  /** 面板根 DOM 引用（由 Portal 组件挂载时赋值） */
  panelRef: Ref<HTMLElement | null>
  /** 外层实时 X 坐标（即时响应） */
  outerX: Ref<number>
  /** 外层实时 Y 坐标（即时响应） */
  outerY: Ref<number>
  /** 外层实时宽度（即时响应） */
  outerWidth: Ref<number>
  /** 外层实时高度（即时响应） */
  outerHeight: Ref<number>
  /** 内层宽度（防抖后更新，供内容区使用） */
  innerWidth: Ref<number>
  /** 内层高度（防抖后更新，供内容区使用） */
  innerHeight: Ref<number>
  /** 是否正在拖拽/缩放交互中 */
  isInteracting: Ref<boolean>
  /** 标题栏高度（px），用于计算内容区尺寸 */
  headerHeight: number
  /**
   * 交互开始处理函数
   * @param direction 方向：move（拖拽）或 n/s/e/w 及组合（缩放）
   * @param event pointerdown 事件
   */
  onHandleDown: (direction: ResizeDirection, event: PointerEvent) => void
  /** 面板是否打开 */
  open: Ref<boolean>
  /** 切换打开状态 */
  onOpenChange: (open: boolean) => void
  /** 关闭面板 */
  close: () => void
  /** 标题文字 */
  title: Ref<string>
  /** 标题 DOM id，用于 aria-labelledby */
  titleId: string
}

/** InjectionKey 符号 */
const draggableContextKey = Symbol('draggable') as InjectionKey<DraggableContext>

/**
 * 提供 Draggable 上下文（在 DraggableRoot 中调用）
 */
export function provideDraggableContext(context: DraggableContext): void {
  provide(draggableContextKey, context)
}

/**
 * 消费 Draggable 上下文（在子组件中调用）
 *
 * 若未找到上下文（即子组件未放在 DraggableRoot 内），
 * 开发环境下抛出有意义的错误提示。
 */
export function useDraggableContext(): DraggableContext {
  const context = inject(draggableContextKey, null)
  if (!context) {
    const compName = (
      new Error().stack
        ?.split('\n')
        .find((line) => line.includes('.vue'))
        ?.match(/([\w-]+\.vue)/)?.[1] ?? '子组件'
    )
    throw new Error(
      `<${compName}> 必须放在 <DraggableRoot> 组件内部使用。`,
    )
  }
  return context
}
