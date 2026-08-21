import { ICON_STATE } from '@/stores/icon'
import type { MarkerThin } from '@/stores/marker'
import type { IconMapping } from '../../layers/genshin-marker-layer'
import { GenshinMarkerLayer } from '../../layers/genshin-marker-layer'
import { defineLayerPlugin } from '../define'
import type { LayerDependencies } from '../types'

/** MarkerLayer 插件消费的依赖 */
export interface MarkerLayerPluginDeps extends LayerDependencies {
  /** 待渲染点位（已筛选 + 伪深度排序） */
  data: MarkerThin[]
  /** 图标 atlas 资源 URL（runRender 产出，变化时更新纹理） */
  iconAtlas?: string
  /** 图标映射（key=iconId -> atlas UV 帧） */
  iconMapping: IconMapping
  /** 图层原点偏移（= tileset.center） */
  positionOffset?: [x: number, y: number]
}

/** 底层底座掩码：state[0]（container），与既有行为一致 */
const DEFAULT_BOTTOM_MASK = () => 0b001
/** 地下点位图钉掩码：state[1]（overlay） */
const OVERLAY_TOP_MASK = (marker: MarkerThin): number => (marker.isOverlay ? 0b010 : 0)

/**
 * 内置点位图层插件（builtin 示例 + 收敛懒重建）。
 *
 * - **固定 layer id**：宿主每次依赖变化重新 createLayer 产出同一 id（'GenshinMarkerLayer'）
 *   的新实例，deck.gl 按 id 就地 diff，只重算变化的 attribute —— 修 KI-04（旧实现
 *   addLayerFrom 先置 null 再 add，导致 attribute 缓冲全量重建）。
 * - `iconAtlas` 为纹理引用变化，同样走 setProps 交由 deck.gl 更新，无需重建。
 * - 当前 mask 语义与既有行为一致：bottom = 底座、top = 地下点位图钉。
 *   hover/active 等新状态位属 Proposal 2 内核扩展（状态纹理并入 atlas 后）+
 *   本 seam 的 resolver 扩展点，不在本期落地。
 */
export const markerLayerPlugin = defineLayerPlugin<MarkerLayerPluginDeps>({
  key: 'builtin/marker',
  slot: 'marker',
  index: 1,
  createLayer(_, deps) {
    return new GenshinMarkerLayer({
      id: 'GenshinMarkerLayer',
      data: deps.data,
      iconAtlas: deps.iconAtlas,
      iconMapping: deps.iconMapping,
      positionOffset: deps.positionOffset,
      maxStateBits: ICON_STATE.length,
      getBottomMask: DEFAULT_BOTTOM_MASK,
      getTopMask: OVERLAY_TOP_MASK,
      updateTriggers: {
        getPosition: deps.positionOffset,
      },
    })
  },
})
