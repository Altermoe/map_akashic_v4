import type { GenshinDeck } from '../core/genshin-deck'
import type { GenshinLayer } from '../types'
import { removeLayerFrom } from '../utils'
import type { LayerDependencies, LayerPlugin, LayerPluginContext } from './types'

interface Mounted<T extends LayerDependencies = LayerDependencies> {
  plugin: LayerPlugin<T>
  ctx: LayerPluginContext
  layer: GenshinLayer
  deps: T
  /** 最近一次放入槽位的图层 id（用于判断 id 是否变化 → 决定是否再次 onMount） */
  layerId: string | undefined
}

/**
 * 图层命令式宿主（对齐「不把 Deck Layer 实例封装成 Vue 组件」）。
 *
 * 职责：
 * 1. 把插件产出的图层挂在 deck layers 指定 index（非破坏替换，保留 deck.gl diffing）；
 * 2. 每次依赖变化重新 {createLayer}，经同 id 就地 reconcile，避免整体重建（修 KI-04）；
 * 3. 统一生命周期：createLayer → onMount → dispose。
 */
export class LayerHost {
  readonly #deck: GenshinDeck
  readonly #mounted = new Map<string, Mounted<any>>()
  #disposed = false

  constructor(deck: GenshinDeck) {
    this.#deck = deck
  }

  /** 已挂载插件 key 列表 */
  get keys(): string[] {
    return [...this.#mounted.keys()]
  }

  /** 挂载插件并用初始依赖放置图层。同一 slot 已占用时先卸载旧插件（保持槽位单一权威）。 */
  mount(plugin: LayerPlugin<any>, deps: LayerDependencies): this {
    this.#assertNotDisposed()
    const existing = this.#slotOccupant(plugin.slot)
    if (existing && existing.plugin.key !== plugin.key) {
      this.unmount(existing.plugin.key)
    }

    const prev = this.#mounted.get(plugin.key)
    if (prev) {
      // 幂等：已挂载同 key 则刷新依赖并就地 reconcile。
      this.#reconcile(prev, { ...prev.deps, ...deps } as any)
      return this
    }

    const ctx: LayerPluginContext = { deck: this.#deck, slot: plugin.slot, index: plugin.index }
    const layer = plugin.createLayer(ctx, deps as any)
    const mounted: Mounted<any> = {
      plugin,
      ctx,
      layer: layer as GenshinLayer,
      deps: deps as any,
      layerId: layer?.id,
    }
    if (layer) {
      this.#place(ctx.index, layer)
      void plugin.onMount?.(ctx, layer, deps as any)
    }
    this.#mounted.set(plugin.key, mounted)
    return this
  }

  /** 批量更新依赖：为每个已挂载插件重新 createLayer 并就地 reconcile。 */
  update(depsByPlugin: Partial<Record<string, LayerDependencies>>): this {
    this.#assertNotDisposed()
    for (const [key, mounted] of this.#mounted) {
      const next = depsByPlugin[key]
      if (next !== undefined) this.#reconcile(mounted, next as any)
    }
    return this
  }

  /** 更新单个插件。 */
  updatePlugin(key: string, next: LayerDependencies): this {
    this.#assertNotDisposed()
    const mounted = this.#mounted.get(key)
    if (mounted) this.#reconcile(mounted, next as any)
    return this
  }

  #reconcile(mounted: Mounted<any>, next: LayerDependencies): void {
    const { plugin, ctx } = mounted
    const layer = plugin.createLayer(ctx, next)
    const nextId = layer?.id
    if (layer) {
      // 非破坏替换：同 id → deck.gl 就地 diff；不同 id → deck.gl 移除旧层新建。
      this.#place(ctx.index, layer)
      // 仅「首次出现该 id」触发一次性副作用（如 applyDeck 初始化视口）。
      if (nextId !== mounted.layerId) {
        void plugin.onMount?.(ctx, layer, next)
      }
    } else if (mounted.layer) {
      // 期望不渲染 → 清掉旧层
      removeLayerFrom(this.#deck, ctx.index, mounted.layer)
    }
    mounted.layer = layer as GenshinLayer
    mounted.layerId = nextId
    mounted.deps = next
  }

  /** 卸载指定插件：移除图层并清理。 */
  unmount(key: string): boolean {
    const mounted = this.#mounted.get(key)
    if (!mounted) return false
    if (mounted.layer) {
      removeLayerFrom(this.#deck, mounted.plugin.index, mounted.layer)
      mounted.plugin.dispose?.(mounted.ctx, mounted.layer)
    }
    this.#mounted.delete(key)
    return true
  }

  /** 卸载全部已挂载插件。 */
  dispose(): void {
    if (this.#disposed) return
    for (const key of [...this.#mounted.keys()]) {
      this.unmount(key)
    }
    this.#mounted.clear()
    this.#disposed = true
  }

  /** 把图层的某个 id 放到指定槽位（就地 diff）。 */
  #place(index: number, layer: GenshinLayer): void {
    const copyLayers = [...(this.#deck.props.layers ?? [])]
    copyLayers[index] = layer
    this.#deck.setProps({ layers: copyLayers })
  }

  #slotOccupant(slot: LayerPlugin['slot']): Mounted | undefined {
    return [...this.#mounted.values()].find((m) => m.plugin.slot === slot)
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error('[layer-host] LayerHost 已 dispose，禁止再挂载/更新')
    }
  }
}
