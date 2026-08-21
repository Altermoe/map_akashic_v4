<script lang="ts">
import type { GenshinDeck } from '../core/genshin-deck'
import type { ResolvedTileset } from '../types'
export interface GenshinLayersHostProps {
  deck: GenshinDeck
  tileset: ResolvedTileset
}
</script>

<script setup lang="ts">
import { Fragment } from 'vue'
import { useFilterStore, useIconStore } from '@/stores'
import { builtinLayerPlugins, registerBuiltinLayerPlugins } from '../plugins/builtins'
import { markerLayerPlugin } from '../plugins/builtins/marker-layer'
import { tileLayerPlugin } from '../plugins/builtins/tile-layer'
import { LayerHost } from '../plugins/layer-host'
import type { LayerDependencies } from '../plugins/types'
import type { UnregisterLayerPlugin } from '../plugins/registry'

const props = defineProps<GenshinLayersHostProps>()

const filterStore = useFilterStore()
const iconStore = useIconStore()

/** 点位（已筛选）按 pos[1] 升序 → 2.5D 伪深度排序（下方点位先画） */
const renderMarkers = computed(() => filterStore.result.toSorted((a, b) => a.pos[1] - b.pos[1]))

const TILE_DEBUG = { showTile: false, showBounds: true, showLayout: true, showTileIndex: true }

/** 按插件 key 汇总当前依赖快照。任何被读取的响应式依赖变化都会触发 host.update。 */
const buildDeps = (): Partial<Record<string, LayerDependencies>> => ({
  [tileLayerPlugin.key]: {
    data: props.tileset,
    visible: true,
    debug: TILE_DEBUG,
  },
  [markerLayerPlugin.key]: {
    data: renderMarkers.value,
    iconAtlas: iconStore.textureUrl,
    iconMapping: iconStore.mapping,
    positionOffset: props.tileset.center,
  },
})

let host: LayerHost | null = null
let unregisterBuiltins: UnregisterLayerPlugin[] = []

onMounted(() => {
  // 可逆副作用：挂载时把内置插件注册进运行时能力目录（registry），卸载时撤销。
  unregisterBuiltins = registerBuiltinLayerPlugins()
  host = new LayerHost(props.deck)
  for (const plugin of builtinLayerPlugins) {
    host.mount(plugin, buildDeps()[plugin.key] ?? {})
  }
})

// 单个 watch 驱动全部图层（命令式，非每个图层的 Vue 包装组件）：
// getter 每次读取响应式依赖并在任一变化时返回新对象 → host.update 就地更新/按需重建。
watch(
  () => buildDeps(),
  (deps) => host?.update(deps),
  { flush: 'post' },
)

onUnmounted(() => {
  host?.dispose()
  host = null
  for (const unregister of unregisterBuiltins) unregister()
  unregisterBuiltins = []
})
</script>

<template>
  <Fragment />
</template>
