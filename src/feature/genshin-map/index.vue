<script setup lang="ts">
import SiderMenus from '@/feature/sider-menus/index.vue'
import DeckGl from './elements/deck-gl.vue'
import LayersHost from './elements/layers-host.vue'
import ScrollZoomController from './elements/scroll-zoom-controller.vue'
import type { ResolvedTileset } from './types'

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
    <!-- 侧边栏插件化：按钮与拓展面板由 SiderMenus 宿主按注册中心动态渲染 -->
    <SiderMenus v-model:area-code="areaCode" />
    <!-- 图层插件化：Tile/Marker 不再作为 Vue 组件包装，交由 LayersHost 命令式挂载 builtin 插件 -->
    <LayersHost :deck="deck" :tileset="tileset" />
  </DeckGl>
</template>
