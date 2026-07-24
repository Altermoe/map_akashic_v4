<script setup lang="ts">
import type { Deck, OrthographicView, OrthographicViewState } from 'deck.gl'
import { LinearInterpolator, OrthographicViewport } from 'deck.gl'
import { fromEvent } from 'rxjs'
import { Fragment } from 'vue'
import type { GenshinDeck } from '../core/genshin-deck'
import { onReady } from '../utils'
import { easeOutQuart } from '../utils/transition-easing'

const props = defineProps<{
  target: HTMLElement
  deck: GenshinDeck
}>()

/**
 * 将视口像素坐标转换为地图坐标
 * - 依据: 当 zoom 为 0 时, 像素偏差值即为地图坐标偏差值
 */
const screenToMap = (
  view: {
    x: number
    y: number
    w: number
    h: number
  },
  center: {
    x: number
    y: number
  }, // 当前地图坐标
  zoom: number,
) => {
  const scale = Math.pow(2, zoom)
  const dx = view.x - view.w / 2
  const dy = view.y - view.h / 2
  const mapX = center.x + dx / scale
  const mapY = center.y + dy / scale
  return { x: mapX, y: mapY }
}

watch(
  () => [props.deck, props.target],
  async () => {
    const { deck, target } = props
    const wheel$ = fromEvent<WheelEvent>(target, 'wheel')
    let currentRIC: number | null = null
    let isCleanup = false
    let unsubscribable: { unsubscribe: () => void } | null = null
    onWatcherCleanup(() => {
      if (currentRIC) {
        cancelIdleCallback(currentRIC)
        currentRIC = null
      }
      if (unsubscribable) {
        unsubscribable.unsubscribe()
        unsubscribable = null
      }
      isCleanup = true
    })
    await onReady(deck, {
      onSchedulerUpdate: (ric) => {
        currentRIC = ric
      },
    })
    if (isCleanup) return
    unsubscribable = wheel$.subscribe((ev) => {
      const viewState = deck.getLiveViewState()
      if (!viewState) return
      const { target: element } = props
      const { x, y, deltaY } = ev
      const { clientWidth, clientHeight } = element
      const {
        target: [oldX, oldY] = [0, 0],
        zoomX = 0,
        minZoomX: minZoom = 0,
        maxZoomX: maxZoom = 0,
      } = viewState

      const speed = 0.005
      const oldZoom = zoomX
      const newZoom = Math.min(Math.max(oldZoom - deltaY * speed, minZoom), maxZoom)
      const { x: pointX, y: pointY } = screenToMap(
        {
          x,
          y,
          h: clientHeight,
          w: clientWidth,
        },
        {
          x: oldX,
          y: oldY,
        },
        oldZoom,
      )
      const scaleRatio = Math.pow(2, oldZoom - newZoom)
      const newTargetX = pointX - (pointX - oldX) * scaleRatio
      const newTargetY = pointY - (pointY - oldY) * scaleRatio

      const transitionInterpolator = new LinearInterpolator({
        transitionProps: ['target', 'zoomX', 'zoomY'],
        around: [x, y],
        makeViewport: (vpProps) =>
          new OrthographicViewport({
            ...vpProps,
            width: vpProps.width ?? clientWidth,
            height: vpProps.height ?? clientHeight,
          }),
      })

      deck.setProps({
        initialViewState: {
          ...viewState,
          zoomX: newZoom,
          zoomY: newZoom,
          target: [newTargetX, newTargetY],
          transitionDuration: 500,
          transitionEasing: easeOutQuart,
          transitionInterpolator,
        },
      })
    })
  },
  { immediate: true },
)
</script>

<template>
  <Fragment />
</template>
