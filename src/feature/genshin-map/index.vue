<script setup lang="ts">
import { OrthographicView, type OrthographicViewState } from 'deck.gl'
import { useMarkerStore, useIconStore } from '@/stores'
import { SiderToolbar } from './components'
import DeckGl from './elements/deck-gl.vue'
import MarkerLayer from './elements/marker-layer.vue'
import ScrollZoomController from './elements/scroll-zoom-controller.vue'
import TileLayer from './elements/tile-layer.vue'
import type { ResolvedTileset } from './types'

defineProps<{
  tileset: ResolvedTileset
}>()

const view = new OrthographicView()

const markerStore = useMarkerStore()
const iconStore = useIconStore()

const viewState = shallowRef<OrthographicViewState>({
  target: [0, 0],
  zoom: 0,
})
const syncViewStateChange = (state: OrthographicViewState) => {
  viewState.value = state
}
</script>

<template>
  <DeckGl
    :view="view"
    v-slot="{ deck, canvas }"
    @view-state-change="(changes) => syncViewStateChange(changes.viewState)"
  >
    <ScrollZoomController :deck="deck" :view-state="viewState" :target="canvas" />
    <SiderToolbar />
    <TileLayer :deck="deck" :index="0" :data="tileset" />
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
