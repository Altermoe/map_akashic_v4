import type { Subscription } from 'rxjs'
import { takeUntil, tap, map, filter, auditTime } from 'rxjs/operators'
import { ref, onBeforeUnmount, type Ref, watch } from 'vue'
import { pointermove$, pointerup$ } from '@/shared/events'

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'move'

export interface UseDraggableResizableOptions {
  /** 初始宽度 */
  initialWidth: number
  /** 初始高度 */
  initialHeight: number
  /** 初始 X 坐标 */
  initialX: number
  /** 初始 Y 坐标 */
  initialY: number
  /** 最小宽度 */
  minWidth: number
  /** 最小高度 */
  minHeight: number
  /** 是否限制在视口内，默认 true */
  constrainToViewport?: boolean
  /** 内部尺寸防抖时间(ms)，默认 150 */
  innerDebounceMs?: number
  /** 面板 DOM 引用；传了之后会监听 offsetParent 的 resize，自动校正到视口内 */
  panelRef?: Ref<HTMLElement | null>
}

export interface UseDraggableResizableReturn {
  outerX: Ref<number>
  outerY: Ref<number>
  outerWidth: Ref<number>
  outerHeight: Ref<number>
  innerWidth: Ref<number>
  innerHeight: Ref<number>
  isInteracting: Ref<boolean>
  /** 在 handle 的 pointerdown 事件中调用，触发一次拖拽/缩放交互 */
  onHandleDown: (direction: ResizeDirection, event: PointerEvent) => void
}

interface DragStart {
  direction: ResizeDirection
  pointerId: number
  startX: number
  startY: number
  startRect: { x: number; y: number; width: number; height: number }
}

/**
 * 可拖拽、可缩放面板的核心逻辑（八向调节 + 拖拽移动）。
 *
 * 使用 RxJS 编排：
 * - 每次 pointerdown 作为起点，订阅全局 move/up 流，takeUntil(up) 结束
 * - 外层尺寸/位置即时响应（绑定到容器 transform/尺寸）
 * - 内层尺寸在交互过程中通过 auditTime 节流，交互结束后立刻同步，
 *   避免内部内容区高频重排
 */
export const useDraggableResizable = (
  options: UseDraggableResizableOptions,
): UseDraggableResizableReturn => {
  const {
    initialWidth,
    initialHeight,
    initialX,
    initialY,
    minWidth,
    minHeight,
    constrainToViewport = true,
    innerDebounceMs = 150,
    panelRef,
  } = options

  // 外层实时状态（即时响应）
  const outerX = ref(initialX)
  const outerY = ref(initialY)
  const outerWidth = ref(initialWidth)
  const outerHeight = ref(initialHeight)

  // 内部状态（节流/防抖后更新，供内容区使用）
  const innerWidth = ref(initialWidth)
  const innerHeight = ref(initialHeight)

  // 是否正在交互
  const isInteracting = ref(false)

  // ========== 视口约束 ==========
  const clampToViewport = (rect: { x: number; y: number; width: number; height: number }) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let { x, y, width, height } = rect

    width = Math.min(width, vw)
    height = Math.min(height, vh)
    x = Math.max(0, Math.min(x, vw - width))
    y = Math.max(0, Math.min(y, vh - height))

    return { x, y, width, height }
  }

  // ========== 根据方向 + 位移 计算新矩形 ==========
  const computeRect = (start: DragStart, dx: number, dy: number) => {
    const { direction, startRect } = start
    let { x, y, width, height } = startRect

    if (direction === 'move') {
      x = startRect.x + dx
      y = startRect.y + dy
    } else {
      if (direction.includes('e')) {
        width = Math.max(minWidth, startRect.width + dx)
      }
      if (direction.includes('w')) {
        const newWidth = Math.max(minWidth, startRect.width - dx)
        x = startRect.x + (startRect.width - newWidth)
        width = newWidth
      }
      if (direction.includes('s')) {
        height = Math.max(minHeight, startRect.height + dy)
      }
      if (direction.includes('n')) {
        const newHeight = Math.max(minHeight, startRect.height - dy)
        y = startRect.y + (startRect.height - newHeight)
        height = newHeight
      }
    }

    const rect = { x, y, width, height }
    return constrainToViewport ? clampToViewport(rect) : rect
  }

  // ========== 同步内层尺寸 ==========
  const syncInner = () => {
    innerWidth.value = outerWidth.value
    innerHeight.value = outerHeight.value
  }

  // ========== 主体 RxJS 流 ==========
  let dragSub: Subscription | null = null

  const onHandleDown = (direction: ResizeDirection, event: PointerEvent) => {
    dragSub?.unsubscribe()

    const target = event.target as Element
    target.setPointerCapture(event.pointerId)
    event.preventDefault()

    const start: DragStart = {
      direction,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: {
        x: outerX.value,
        y: outerY.value,
        width: outerWidth.value,
        height: outerHeight.value,
      },
    }

    isInteracting.value = true

    // 结束流：pointerup 匹配当前 pointerId
    const end$ = pointerup$.pipe(
      filter((e) => e.pointerId === start.pointerId),
      tap(() => {
        isInteracting.value = false
        target.releasePointerCapture(start.pointerId)
        // 交互结束，立即同步内部尺寸（保证最终态一致）
        syncInner()
      }),
    )

    // 矩形流：每次 move 计算新矩形
    const rect$ = pointermove$.pipe(
      filter((e) => e.pointerId === start.pointerId),
      map((e) => computeRect(start, e.clientX - start.startX, e.clientY - start.startY)),
      takeUntil(end$),
    )

    // 外层即时更新
    const outerSub = rect$.subscribe((rect) => {
      outerX.value = rect.x
      outerY.value = rect.y
      outerWidth.value = rect.width
      outerHeight.value = rect.height
    })

    // 内层节流更新：auditTime 在交互过程中定期采样，避免高频重排
    const innerSub = rect$.pipe(auditTime(innerDebounceMs)).subscribe(() => {
      syncInner()
    })

    // 合并订阅，统一管理生命周期
    dragSub = {
      unsubscribe() {
        outerSub.unsubscribe()
        innerSub.unsubscribe()
      },
      closed: false,
    } as Subscription
  }

  // ========== 清理 ==========
  onBeforeUnmount(() => {
    dragSub?.unsubscribe()
    parentResizeObserver?.disconnect()
    if (parentResizeStopTimer) {
      clearTimeout(parentResizeStopTimer)
    }
    window.removeEventListener('resize', onWindowResize)
  })

  // ========== offsetParent resize 后自动校正到视口内 ==========
  let parentResizeObserver: ResizeObserver | null = null
  let parentResizeStopTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 将面板校正到视口内。
   * - 面板 <= 视口：完整限制在视口内
   * - 面板 > 视口：保证左上角可见（顶部、左边缘贴住视口或在视口内）
   */
  const correctPositionToViewport = () => {
    if (!constrainToViewport || isInteracting.value) return
    const el = panelRef?.value
    if (!el) return
    const parent = el.offsetParent as HTMLElement | null
    if (!parent) return

    const parentRect = parent.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = outerWidth.value
    const h = outerHeight.value

    // 当前面板左上角在视口中的坐标
    let vpX = parentRect.left + outerX.value
    let vpY = parentRect.top + outerY.value

    // 水平方向
    if (w <= vw) {
      // 完整容纳：保证整个面板在视口内
      vpX = Math.max(0, Math.min(vpX, vw - w))
    } else {
      // 视口不够大：保证左上角可见（左边缘不滑出视口左边）
      // 即 vpX <= 0 时把它拉回 0；右边允许溢出
      if (vpX < 0) vpX = 0
      // 也防止整个面板从右边飞出（左上角仍然可见的最大右移）
      if (vpX > vw - 1) vpX = vw - 1
    }

    // 垂直方向
    if (h <= vh) {
      vpY = Math.max(0, Math.min(vpY, vh - h))
    } else {
      if (vpY < 0) vpY = 0
      if (vpY > vh - 1) vpY = vh - 1
    }

    // 转回 offsetParent 相对坐标
    const newX = vpX - parentRect.left
    const newY = vpY - parentRect.top

    if (newX !== outerX.value || newY !== outerY.value) {
      outerX.value = newX
      outerY.value = newY
      syncInner()
    }
  }

  /**
   * 监听 offsetParent 的 resize。
   * 在 resize 停止后（debounce）执行一次视口校正，避免调整过程中反复跳动。
   */
  const setupParentResizeObserver = () => {
    if (!panelRef?.value || !constrainToViewport) return
    const parent = panelRef.value.offsetParent as HTMLElement | null
    if (!parent) return

    parentResizeObserver?.disconnect()
    parentResizeObserver = new ResizeObserver(() => {
      if (parentResizeStopTimer) clearTimeout(parentResizeStopTimer)
      parentResizeStopTimer = setTimeout(() => {
        correctPositionToViewport()
      }, 150)
    })
    parentResizeObserver.observe(parent)
  }

  // 窗口 resize 也需要校正（视口变了）
  const onWindowResize = () => {
    correctPositionToViewport()
  }

  if (panelRef && constrainToViewport) {
    watch(
      panelRef,
      (el, _prev, onCleanup) => {
        if (!el) return
        setupParentResizeObserver()
        window.addEventListener('resize', onWindowResize)
        onCleanup(() => {
          parentResizeObserver?.disconnect()
          if (parentResizeStopTimer) {
            clearTimeout(parentResizeStopTimer)
          }
          window.removeEventListener('resize', onWindowResize)
        })
      },
      { immediate: true },
    )
  }

  return {
    outerX,
    outerY,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    isInteracting,
    onHandleDown,
  }
}
