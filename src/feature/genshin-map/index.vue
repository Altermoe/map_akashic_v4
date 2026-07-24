<script setup lang="ts">
import type { OrthographicViewState } from 'deck.gl'
import { useFilterStore, useIconStore } from '@/stores'
import { SiderToolbar } from './components'
import DeckGl from './elements/deck-gl.vue'
import MarkerLayer from './elements/marker-layer.vue'
import ScrollZoomController from './elements/scroll-zoom-controller.vue'
import TileLayer from './elements/tile-layer.vue'
import type { ResolvedTileset } from './types'

const ItemFilter = defineAsyncComponent(() => import('@/feature/sider-menus/item-filter/index.vue'))
const ItemLocale = defineAsyncComponent(() => import('@/feature/sider-menus/item-locale/index.vue'))
const ItemSetting = defineAsyncComponent(
  () => import('@/feature/sider-menus/item-setting/index.vue'),
)

defineProps<{
  tileset: ResolvedTileset
}>()

const areaCode = defineModel<string | undefined>('areaCode', {
  required: false,
  default: '',
})

const filterStore = useFilterStore()
const iconStore = useIconStore()

const renderMarkers = computed(() =>
  filterStore.result.toSorted((a, b) => {
    return a.pos[1] - b.pos[1]
  }),
)
</script>

<template>
  <DeckGl v-slot="{ deck, canvas }">
    <ScrollZoomController :deck="deck" :target="canvas" />
    <SiderToolbar>
      <template #filter>
        <ItemFilter v-model:area-code="areaCode" />
      </template>
      <template #locale>
        <ItemLocale />
      </template>
      <template #setting>
        <ItemSetting />
      </template>
    </SiderToolbar>
    <TileLayer
      :deck="deck"
      :index="0"
      :data="tileset"
      :debug="{ showTile: false, showBounds: true, showLayout: true, showTileIndex: true }"
    />
    <MarkerLayer
      :deck="deck"
      :index="1"
      :data="renderMarkers"
      :position-offset="tileset.center"
      :icon-atlas="iconStore.textureUrl"
      :icon-mapping="iconStore.mapping"
    />
  </DeckGl>
</template>
