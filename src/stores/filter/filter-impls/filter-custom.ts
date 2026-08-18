import { useItemCatalogStore } from '@/stores/item-catalog'
import { useMarkerStore } from '@/stores/marker'
import { defineFilter } from './index'

export interface CustomFilterParams {
  /** 已勾选的物品类型 id；空数组表示无选中，返回空结果 */
  typeIds: number[]
}

/**
 * 自定义筛选：按勾选类型组合过滤点位。
 * 勾选类型 -> 物品并集 -> 反查索引，与 basic 相同的集合计算思路。
 */
export const filterCustom = defineFilter({
  id: 'custom',
  name: '类型组合筛选',
  apply: async (input, params: CustomFilterParams) => {
    const { typeIds } = params
    if (!typeIds.length) return []

    const catalogStore = useItemCatalogStore()
    if (!catalogStore.loaded) await catalogStore.ensureLoaded()
    // 目录加载失败时返回空，避免误显示全量点位
    if (!catalogStore.loaded) return []

    const itemIds = new Set<number>()
    for (const tid of typeIds) {
      const list = catalogStore.typeItemIds.get(tid)
      if (list) {
        for (const id of list) itemIds.add(id)
      }
    }
    if (!itemIds.size) return []

    const { itemMarkerIndex } = useMarkerStore()
    const matchingIds = new Set<string>()
    for (const itemId of itemIds) {
      const set = itemMarkerIndex.get(itemId)
      if (set) {
        for (const id of set) matchingIds.add(id)
      }
    }
    return input.filter((m) => matchingIds.has(m.id))
  },
})
