import { defineStore } from 'pinia'
import { useAsyncStore } from '@/stores/async'
import { useMarkerStore, type MarkerThin } from '@/stores/marker'
import {
  builtinFilters,
  type FilterContext,
  type FilterImpl,
  type FilterId,
  type FilterParamsOf,
} from './filter-impls'

export type { FilterContext, FilterImpl, FilterId, FilterParamsOf } from './filter-impls'
export { defineFilter } from './filter-impls'

export const useFilterStore = defineStore('filter', () => {
  const markerStore = useMarkerStore()
  const asyncStore = useAsyncStore()

  /** 预制 filter 实现表（id -> impl），非响应式、不可运行时变更 */
  const registry = new Map<FilterId, FilterImpl<any>>()
  /** 已激活的 filter 及其参数，按激活顺序保持插入序 */
  const active = ref(new Map<FilterId, unknown>())
  /** pipeline 最终输出 */
  const result = shallowRef<MarkerThin[]>([])
  const loading = ref(false)

  for (const impl of builtinFilters) registry.set(impl.id, impl)

  /** 并发令牌：每次重算递增，旧任务自检失效 */
  let token = 0
  let currentController: AbortController | null = null

  const recompute = async () => {
    currentController?.abort()
    const my = ++token
    const controller = new AbortController()
    currentController = controller
    loading.value = true
    try {
      await asyncStore.run(
        async ({ signal, progress }) => {
          const source = markerStore.indexList
          let acc: MarkerThin[] = source ? [...source] : []
          const ids = [...active.value.keys()]
          let i = 0
          for (const [id, params] of active.value) {
            if (my !== token || signal.aborted) return
            const impl = registry.get(id)
            if (!impl) continue
            const ctx: FilterContext = {
              signal,
              progress: (v, msg) => progress(i / ids.length + v / ids.length, msg ?? impl.name),
              pipeline: ids.slice(0, i + 1),
            }
            acc = await impl.apply(acc, params, ctx)
            i++
          }
          if (my !== token || signal.aborted) return
          result.value = acc
        },
        { title: '应用筛选器', controller },
      )
    } finally {
      if (my === token) {
        loading.value = false
        if (currentController === controller) currentController = null
      }
    }
  }

  watch(
    () => markerStore.indexList,
    () => recompute(),
    { immediate: true },
  )

  /**
   * 应用（激活）指定 filter 并传入参数；返回 pipeline 最终结果。
   * 同一 id 再次 apply 视为更新参数。id 与 params 类型由预制注册表推导。
   */
  const applyFilter = async <TId extends FilterId>(
    id: TId,
    params: FilterParamsOf<TId>,
  ): Promise<MarkerThin[]> => {
    if (!registry.has(id)) throw new Error(`[filter] 未注册的 filter: ${id}`)
    const next = new Map(active.value)
    next.set(id, params)
    active.value = next
    await recompute()
    return result.value
  }

  /** 清除指定 filter：调用其 clear（若有），移出激活集合并重算 */
  const clearFilter = async (id: FilterId): Promise<void> => {
    const impl = registry.get(id)
    await impl?.clear?.({
      signal: new AbortController().signal,
      progress: () => {},
      pipeline: [...active.value.keys()],
    })
    if (!active.value.has(id)) return
    const next = new Map(active.value)
    next.delete(id)
    active.value = next
    await recompute()
  }

  /** 清除全部已激活 filter（保留注册项） */
  const clearAllFilters = async (): Promise<void> => {
    active.value = new Map()
    await recompute()
  }

  return {
    loading,
    result: result as Readonly<ShallowRef<MarkerThin[]>>,
    /** 当前激活的 filter id 序列 */
    active: computed(() => [...active.value.keys()]),
    applyFilter,
    clearFilter,
    clearAllFilters,
  }
})
