import { useMarkerStore } from '@/stores/marker'
import { defineFilter } from './index'

export interface BasicFilterParams {
  /** 已选物品 id 列表；空数组表示无选中，返回空结果 */
  itemIds: number[]
}

/** 按已选物品 id 过滤点位，使用反查索引实现高效集合计算 */
export const filterBasic = defineFilter({
  id: 'basic',
  name: '物品过滤',
  apply: (input, params: BasicFilterParams) => {
    const { itemIds } = params
    if (!itemIds || itemIds.length === 0) return []

    const { itemMarkerIndex } = useMarkerStore()

    // 反查索引：收集所有匹配的 marker id
    const matchingIds = new Set<string>()
    for (const itemId of itemIds) {
      const set = itemMarkerIndex.get(itemId)
      if (set) {
        for (const id of set) {
          matchingIds.add(id)
        }
      }
    }

    return input.filter((m) => matchingIds.has(m.id))
  },
})
