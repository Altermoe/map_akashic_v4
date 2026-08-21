import { computed, shallowRef } from 'vue'
import type { SiderItem, SiderLayout } from './types'

/**
 * 侧边栏条目注册中心（可逆副作用，对齐 Proposal 1 §1/§3 + layers `registry.ts`）。
 *
 * - `registerSiderItem` 返回 `unregister`：随插件挂载/卸载撤销注册，是可逆副作用；
 * - 运行时作为「侧边栏能力目录」：宿主按布局分区拉取已排序条目；
 * - 与 layers 注册中心不同，这里持有一个 `version` shallowRef，宿主可将其纳入
 *   响应式推导 —— 条目注册/注销即触发侧边栏 UI 重渲染；
 * - 模块零 UI 依赖，便于纯逻辑单测。
 */
const registry = new Map<string, SiderItem>()

/** 版本号：每次注册/注销自增，驱动宿主重算条目列表 */
const version = shallowRef(0)
const bump = () => {
  version.value++
}

const sortByOrder = (a: SiderItem, b: SiderItem) => a.order - b.order

/** 已注册条目全集（注册序传递，同分区内按 order 稳定升序）。 */
export const siderItems = computed<SiderItem[]>(() => {
  void version.value
  return [...registry.values()].sort(sortByOrder)
})

/** 按布局分区分组；`top` / `bottom` 各为一个按 order 升序的数组。 */
export const siderItemsByLayout = computed<Record<SiderLayout, SiderItem[]>>(() => {
  void version.value
  const groups: Record<SiderLayout, SiderItem[]> = { top: [], bottom: [] }
  for (const item of registry.values()) groups[item.layout].push(item)
  groups.top.sort(sortByOrder)
  groups.bottom.sort(sortByOrder)
  return groups
})

export type UnregisterSiderItem = () => boolean

/** 注册一个侧边栏条目。重复 id 会抛错（幂等由调用方保证）。 */
export function registerSiderItem(item: SiderItem): UnregisterSiderItem {
  if (registry.has(item.id)) {
    throw new Error(`[sider-plugin] 重复注册 id: ${item.id}`)
  }
  registry.set(item.id, item)
  bump()
  return () => unregisterSiderItem(item.id)
}

/** 批量注册；返回全部 unregister 函数（与入参同序）。 */
export function registerSiderItems(items: readonly SiderItem[]): UnregisterSiderItem[] {
  return items.map((item) => registerSiderItem(item))
}

/** 撤销注册；返回是否确实移除了该 id。 */
export function unregisterSiderItem(id: string): boolean {
  const removed = registry.delete(id)
  if (removed) bump()
  return removed
}

export function hasSiderItem(id: string): boolean {
  return registry.has(id)
}

export function getSiderItem(id: string): SiderItem | undefined {
  return registry.get(id)
}

/** 全部已注册条目，按 order 升序（插入序保序）。 */
export function getSiderItems(): SiderItem[] {
  return [...registry.values()].sort(sortByOrder)
}

/** 指定分区（或全部）的已注册条目，按 order 升序（插入序保序）。 */
export function getSiderItemsByLayout(layout?: SiderLayout): SiderItem[] {
  const items = layout
    ? [...registry.values()].filter((i) => i.layout === layout)
    : [...registry.values()]
  return items.sort(sortByOrder)
}

/** 清空注册表（测试/热载使用）。返回被移除数量。 */
export function clearSiderItems(): number {
  const count = registry.size
  registry.clear()
  if (count) bump()
  return count
}
