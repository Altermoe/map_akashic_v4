<script lang="ts">
import type { View, OrthographicViewState } from '@deck.gl/core'

export interface GenshinMapPaops {}
</script>

<script setup lang="ts" generic="ViewT extends View">
import { OrthographicView } from 'deck.gl'
import { GenshinDeck } from '../core/genshin-deck'

const emits = defineEmits<{
  viewStateChange: [OrthographicViewState]
}>()

const canvasRef = useTemplateRef('canvasRef')
const deckRef = shallowRef<GenshinDeck | null>(null)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) {
    throw new Error('Canvas not found.')
  }
  const deck = new GenshinDeck({
    canvas,
    views: new OrthographicView(),
    // 性能优化: 视口变化期间禁用 pick 以提高帧率
    onInteractionStateChange: (state) => {
      const changing = Boolean(
        state.inTransition ||
        state.isDragging ||
        state.isPanning ||
        state.isZooming ||
        state.isRotating,
      )
      const pickable = !changing
      if (deck.props._pickable === pickable) return
      deck.setProps({ _pickable: pickable })
    },
    onViewStateChange: ({ viewState }) => {
      emits('viewStateChange', viewState)
      return viewState
    },
    getCursor: ({ isDragging, isHovering }) => {
      return isDragging ? 'grabbing' : isHovering ? 'pointer' : 'default'
    },
  })

  let rIC = -1
  const untilReady = () => {
    if (deck.isInitialized) {
      deckRef.value = deck
      return
    }
    rIC = requestIdleCallback(untilReady)
  }
  untilReady()

  deckRef.value = deck

  onUnmounted(() => {
    deck.finalize()
  })
})
</script>

<template>
  <div class="fixed w-100dvw h-100dvh overflow-hidden bg-black truncate">
    <canvas v-bind="$attrs" ref="canvasRef" />
    <slot v-if="canvasRef && deckRef" name="default" :deck="deckRef" :canvas="canvasRef" />
  </div>
</template>
