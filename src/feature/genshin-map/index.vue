<script setup lang="ts">
import type { OrthographicViewState } from 'deck.gl'
import { SiderToolbar } from './components'
import DeckGl from './elements/deck-gl.vue'
import LayersHost from './elements/layers-host.vue'
import ScrollZoomController from './elements/scroll-zoom-controller.vue'
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
    <!-- 图层插件化：Tile/Marker 不再作为 Vue 组件包装，交由 LayersHost 命令式挂载 builtin 插件 -->
    <LayersHost :deck="deck" :tileset="tileset" />
  </DeckGl>
</template>
