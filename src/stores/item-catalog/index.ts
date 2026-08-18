import { defineStore } from 'pinia'
import Api from '@/api'
import type { PageListVoItemVo } from '@/api/services/main/globals'

const PAGE_SIZE = 300
const MAX_PAGES = 20

/**
 * 全量物品目录 store：为「自定义筛选器」提供 类型 -> 物品 映射。
 * 数据源为 item.listItemIdByType（空过滤条件 = 全量），分页累积，alova 缓存 1h。
 */
export const useItemCatalogStore = defineStore('itemCatalog', () => {
  /** 类型 id -> 该类型下物品 id 列表（按查询结果原样收集，含非末端类型） */
  const typeItemIds = shallowRef(new Map<number, number[]>())
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<unknown>(null)

  /** 拉取全量物品目录；幂等，已加载或加载中则直接返回 */
  const ensureLoaded = async (): Promise<void> => {
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const acc = new Map<number, number[]>()
      const seen = new Set<number>()
      let current = 1
      let total = Number.POSITIVE_INFINITY
      while (current <= MAX_PAGES) {
        const page = await Api.main.item
          .listItemIdByType({
            cacheFor: { mode: 'restore', expire: 60 * 60 * 1000 },
            data: {
              typeIdList: [],
              areaIdList: [],
              current,
              size: PAGE_SIZE,
              sort: ['sortIndex-'],
            },
            transform: (res) => res.data as PageListVoItemVo | undefined,
          })
          .send()
        const record = page?.record ?? []
        if (page?.total !== undefined) total = page.total
        let appended = 0
        for (const item of record) {
          if (item.id === undefined || seen.has(item.id)) continue
          seen.add(item.id)
          appended++
          for (const tid of item.typeIdList ?? []) {
            let list = acc.get(tid)
            if (!list) {
              list = []
              acc.set(tid, list)
            }
            list.push(item.id)
          }
        }
        // 终止条件：空页 / 无新数据 / 已收满 total / 未满一页
        if (appended === 0 || seen.size >= total || record.length < PAGE_SIZE) break
        current++
      }
      typeItemIds.value = acc
      loaded.value = true
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  return { typeItemIds, loaded, loading, error, ensureLoaded }
})
