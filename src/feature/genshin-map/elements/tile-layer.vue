<script lang="ts">
export interface TileLayerProps {
  deck: Deck<OrthographicView>
  data: ResolvedTileset
  index: number
  visible?: boolean
}
</script>

<script setup lang="ts">
import type { Deck, OrthographicView } from 'deck.gl'
import { Fragment } from 'vue'
import { GenshinTileLayer } from '../layers/genshin-tile-layer'
import type { ResolvedTileset } from '../types'
import { removeLayerFrom, addLayerFrom } from '../utils'

const props = withDefaults(defineProps<TileLayerProps>(), {
  visible: true,
})

onMounted(() => {
  let instance: GenshinTileLayer | null = null

  const { stop } = watchEffect(() => {
    const { deck, data, index, visible } = props
    const layer = new GenshinTileLayer(data, visible)
    addLayerFrom(deck, index, layer)
    layer.applyDeck(deck)
    instance = layer
  })

  onUnmounted(() => {
    stop()
    if (instance) {
      removeLayerFrom(props.deck, props.index, instance)
    }
  })
})
</script>

<template>
  <Fragment />
</template>
