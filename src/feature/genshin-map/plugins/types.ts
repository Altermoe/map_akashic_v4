import type { GenshinDeck } from '../core/genshin-deck'
import type { GenshinLayer } from '../types'

/**
 * 图层挂载槽位。
 * 插件架构下，瓦片与点位图层各占一个 deck layers 数组槽位，
 * 由宿主（LayerHost）在运行时命令式挂载，而非通过 Vue 组件封装。
 */
export type LayerSlot = 'tile' | 'marker'

/**
 * 插件消费的依赖快照。
 * 结构上允许任意字段；宿主在每次变化时重新求值并通过 {createLayer} 产出新图层。
 */
export type LayerDependencies = Readonly<Record<string, unknown>>

/** 挂载上下文：宿主在 mount/update 生命周期注入 deck 与槽位信息 */
export interface LayerPluginContext {
  /** 唯一渲染宿主（deck.gl Deck 实例） */
  deck: GenshinDeck
  /** 挂载槽位 */
  slot: LayerSlot
  /** deck layers 数组中的槽位索引 */
  index: number
}

/**
 * 图层插件 seam 契约（对齐 Proposal 1 的「引擎复杂给内核、接口简单给社区」）。
 *
 * 更新模型（对齐 deck.gl 的 diffing 语义 + 修复 KI-04）：
 * - 宿主在依赖变化时调用 {createLayer} 产出**同一个 id** 的新图层实例，并经
 *   非破坏方式放回同槽位 → LeafManager 按 id 就地 reconcile，仅重算变化的
 *   attribute，**不**整体重建（旧实现 addLayerFrom 会先置 null 再 add，导致全量重建）；
 * - 插件要表达「真正换一个图层类型」时，改变 createLayer 返回的 id 即可
 *   （deck.gl 会移除旧层并新建）。
 *
 * @template T 该插件消费的依赖类型
 */
export interface LayerPlugin<T extends LayerDependencies = LayerDependencies> {
  /** 全局唯一 id，用作注册键、挂载键与调试标识 */
  key: string
  /** 挂载槽位 */
  slot: LayerSlot
  /** deck layers 数组中的槽位索引（与 slot 配套） */
  index: number
  /**
   * 由依赖快照产出图层实例。**必须为同一逻辑图层返回稳定 id**（局部可写入 id prop），
   * 以保证 deck.gl 就地 diff。返回 null 表示「暂不渲染」（如数据未就绪）。
   */
  createLayer(ctx: LayerPluginContext, deps: T): GenshinLayer | null
  /** 首次挂载（或返回 id 变化）之后的一次性副作用（如 TileLayer.applyDeck / 初始化视口）。可选 */
  onMount?(ctx: LayerPluginContext, layer: GenshinLayer, deps: T): void | Promise<void>
  /** 卸载清理 */
  dispose?(ctx: LayerPluginContext, layer: GenshinLayer): void
}
