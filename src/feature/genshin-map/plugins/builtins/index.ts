import { hasLayerPlugin, registerLayerPlugin, type UnregisterLayerPlugin } from '../registry'
import type { LayerPlugin } from '../types'
import { markerLayerPlugin } from './marker-layer'
import { tileLayerPlugin } from './tile-layer'

/** 内置图层插件清单（挂载顺序 = 槽位挂载顺序） */
export const builtinLayerPlugins: LayerPlugin<any>[] = [tileLayerPlugin, markerLayerPlugin]

/**
 * 把内置图层插件注册进运行时「能力目录」（registry）。
 * - 对已注册 key 幂等（HMR / 重复挂载不抛错）；
 * - 返回一组可逆 unregister，随宿主卸载/热载时调用即可撤销注册。
 */
export function registerBuiltinLayerPlugins(): UnregisterLayerPlugin[] {
  return builtinLayerPlugins.flatMap((plugin) => {
    if (hasLayerPlugin(plugin.key)) return []
    return [registerLayerPlugin(plugin)]
  })
}
