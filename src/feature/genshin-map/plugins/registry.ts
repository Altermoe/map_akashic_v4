import type { LayerPlugin, LayerSlot } from './types'

/**
 * 图层插件注册中心（可逆副作用，对齐 Proposal 1 §1/§3.1）。
 *
 * - register 返回 unregister ：随插件挂载/卸载撤销注册，是可逆副作用；
 * - 作为运行时「能力目录」：宿主可按 slot 拉取插件实例；
 * - 该模块零 deck.gl 依赖，便于纯逻辑单测。
 */
const registry = new Map<string, LayerPlugin<any>>()

export type UnregisterLayerPlugin = () => boolean

/** 注册一个图层插件。重复 key 会抛错（幂等由调用方保证）。 */
export function registerLayerPlugin(plugin: LayerPlugin<any>): UnregisterLayerPlugin {
  if (registry.has(plugin.key)) {
    throw new Error(`[layer-plugin] 重复注册 key: ${plugin.key}`)
  }
  registry.set(plugin.key, plugin)
  return () => unregisterLayerPlugin(plugin.key)
}

/** 撤销注册；返回是否确实移除了该 key。 */
export function unregisterLayerPlugin(key: string): boolean {
  return registry.delete(key)
}

export function hasLayerPlugin(key: string): boolean {
  return registry.has(key)
}

/** 全部已注册插件（插入序）。 */
export function getLayerPlugins(): LayerPlugin<any>[] {
  return [...registry.values()]
}

/** 指定槽位的已注册插件（插入序）。 */
export function getLayerPluginsBySlot(slot: LayerSlot): LayerPlugin<any>[] {
  return [...registry.values()].filter((p) => p.slot === slot)
}

/** 清空注册表（测试/热载使用）。返回被移除数量。 */
export function clearLayerPlugins(): number {
  const count = registry.size
  registry.clear()
  return count
}
