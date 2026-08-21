import type { SiderItem } from './types'

/**
 * 侧边栏条目工厂：为插件实现提供字面量级类型校验与推导（对齐 `defineFilter` 风格）。
 * `TId` 由 `id` 字面量推导，供宿主/调用方得到「已注册条目 id 联合」。
 */
export function defineSiderItem<TId extends string = string>(
  item: SiderItem & { id: TId },
): SiderItem & { id: TId } {
  return item
}