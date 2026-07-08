<script setup lang="ts">
import { OrthographicView } from 'deck.gl'
import { useMarkerStore, useIconStore } from '@/stores'
import DeckGl from './elements/deck-gl.vue'
import MarkerLayer from './elements/marker-layer.vue'
import TileLayer from './elements/tile-layer.vue'
import type { ResolvedTileset } from './types'

defineProps<{
  tileset: ResolvedTileset
}>()

const view = new OrthographicView()

const markerStore = useMarkerStore()
const iconStore = useIconStore()
</script>

<template>
  <DeckGl :views="view" v-slot="{ deck }">
    <TileLayer :deck="deck" :index="0" :data="tileset" :visible="false" />
    <MarkerLayer
      :deck="deck"
      :index="1"
      :data="markerStore.indexList"
      :position-offset="tileset.center"
      :icon-atlas="iconStore.textureUrl"
      :icon-mapping="iconStore.mapping"
    />
  </DeckGl>
</template>
