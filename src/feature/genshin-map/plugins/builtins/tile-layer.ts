import type { ResolvedTileset } from '../../types'
import { GenshinTileLayer, type TileLayerDebugOptions } from '../../layers/genshin-tile-layer'
import { defineLayerPlugin } from '../define'
import type { LayerDependencies } from '../types'

/** TileLayer 插件消费的依赖 */
export interface TileLayerPluginDeps extends LayerDependencies {
  /** 已解析瓦片配置（面积/区域切换时 data.id 变化 → deck.gl 就地 diff 更新） */
  data: ResolvedTileset
  /** 是否可见 @default true */
  visible?: boolean
  /** 开发者调试选项（网格/边界/索引） */
  debug?: TileLayerDebugOptions
}

/**
 * 内置瓦片图层插件（builtin 示例）。
 * 宿主依赖变化时重新调用 createLayer；只要 GenshinTileLayer 的 id 稳定
 * （= 'GenshinTileLayer'），deck.gl 就按 id 就地 diff 更新，而非整体重建。
 * 首次挂载后调用 applyDeck 做一次视口/控制器初始化。
 */
export const tileLayerPlugin = defineLayerPlugin<TileLayerPluginDeps>({
  key: 'builtin/tile',
  slot: 'tile',
  index: 0,
  createLayer(_, deps) {
    return new GenshinTileLayer(deps.data, deps.visible ?? true, deps.debug)
  },
  onMount(ctx, layer) {
    void (layer as GenshinTileLayer).applyDeck(ctx.deck)
  },
})
