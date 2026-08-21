import type { LayerDependencies, LayerPlugin } from './types'

/**
 * 图层插件工厂：为插件实现提供字面量级类型校验与推导（对齐 defineFilter 风格）。
 * TId 由 key 字面量推导，T 为插件消费的依赖类型。
 */
export function defineLayerPlugin<T extends LayerDependencies, TId extends string = string>(
  plugin: LayerPlugin<T> & { key: TId },
): LayerPlugin<T> {
  return plugin
}
