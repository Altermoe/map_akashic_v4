<script lang="ts">
import type { View } from '@deck.gl/core'

export interface DeckGlProps<ViewT extends View> {
  view: ViewT
}
</script>

<script setup lang="ts" generic="ViewT extends View">
import { Deck } from 'deck.gl'

const props = defineProps<DeckGlProps<ViewT>>()
const emits = defineEmits<{
  viewStateChange: Parameters<Required<Deck<ViewT>['props']>['onViewStateChange']>
}>()

const canvasRef = useTemplateRef('canvasRef')
const deckRef = shallowRef<Deck<ViewT> | null>(null)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) {
    throw new Error('Canvas not found.')
  }
  const deck = new Deck<ViewT>({
    canvas,
    views: props.view,
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
    onViewStateChange: (changes) => {
      emits('viewStateChange', changes)
      return changes.viewState
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

  const effects: { stop: () => void }[] = [
    { stop: () => cancelIdleCallback(rIC) },
    watch(
      () => props.view,
      (views) => {
        deck.setProps({ views })
      },
    ),
  ]

  onUnmounted(() => {
    effects.forEach(({ stop }) => stop())
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
