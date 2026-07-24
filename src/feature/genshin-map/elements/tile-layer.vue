<script lang="ts">
export interface TileLayerProps {
  deck: GenshinDeck
  data: ResolvedTileset
  index: number
  visible?: boolean
  /** 是否启用开发者模式 */
  debug?: TileLayerDebugOptions
}
</script>

<script setup lang="ts">
import { Fragment } from 'vue'
import type { GenshinDeck } from '../core/genshin-deck'
import { GenshinTileLayer } from '../layers/genshin-tile-layer'
import type { TileLayerDebugOptions } from '../layers/genshin-tile-layer'
import type { ResolvedTileset } from '../types'
import { removeLayerFrom, addLayerFrom } from '../utils'

const props = withDefaults(defineProps<TileLayerProps>(), {
  visible: true,
})

onMounted(() => {
  let instance: GenshinTileLayer | null = null

  const { stop } = watchEffect(() => {
    const { deck, data, index, visible, debug } = props
    const layer = new GenshinTileLayer(data, visible, debug)
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
