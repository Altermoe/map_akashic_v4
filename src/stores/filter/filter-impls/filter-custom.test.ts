import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkerThin } from '@/stores/marker'
import type { FilterContext } from './index'

const state = vi.hoisted(() => ({
  catalogLoaded: true,
  ensureLoaded: () => {},
  typeItemIds: new Map<number, number[]>(),
  itemMarkerIndex: new Map<number, Set<string>>(),
}))

// seam Provider 替换：替换两个 store 的可控 fake，只测自定义筛选的组合逻辑
vi.mock('@/stores/item-catalog', () => ({
  useItemCatalogStore: () => ({
    // getter 让「ensureLoaded 后重新读取 loaded」反映最新状态
    get loaded() {
      return state.catalogLoaded
    },
    ensureLoaded: state.ensureLoaded,
    typeItemIds: state.typeItemIds,
  }),
}))
vi.mock('@/stores/marker', () => ({
  useMarkerStore: () => ({ itemMarkerIndex: state.itemMarkerIndex }),
}))

import { filterCustom } from './filter-custom'

const ctx: FilterContext = {
  signal: new AbortController().signal,
  progress: () => {},
  pipeline: ['custom'],
}

const markers: MarkerThin[] = [
  { id: 'a', name: 'A', icon: '1', pos: [0, 0], isOverlay: false, itemIds: [10] },
  { id: 'b', name: 'B', icon: '2', pos: [1, 1], isOverlay: false, itemIds: [20] },
  { id: 'c', name: 'C', icon: '3', pos: [2, 2], isOverlay: false, itemIds: [30] },
]

const indexOf = (pairs: [number, string[]][]): Map<number, Set<string>> =>
  new Map(pairs.map(([k, v]) => [k, new Set(v)]))

beforeEach(() => {
  state.catalogLoaded = true
  state.ensureLoaded = () => {}
  state.typeItemIds = new Map([
    [1, [10, 20]],
    [2, [30]],
  ])
  state.itemMarkerIndex = indexOf([
    [10, ['a']],
    [20, ['b']],
    [30, ['c']],
  ])
})

describe('filterCustom（类型组合筛选）', () => {
  it('按勾选类型做物品并集再反查，命中对应点位', async () => {
    expect(await filterCustom.apply(markers, { typeIds: [1] }, ctx)).toEqual([
      markers[0],
      markers[1],
    ])
    expect(await filterCustom.apply(markers, { typeIds: [1, 2] }, ctx)).toEqual(markers)
  })

  it('空类型返回空', async () => {
    expect(await filterCustom.apply(markers, { typeIds: [] }, ctx)).toEqual([])
  })

  it('勾选类型不包含任何物品返回空', async () => {
    state.typeItemIds = new Map()
    expect(await filterCustom.apply(markers, { typeIds: [1] }, ctx)).toEqual([])
  })

  it('目录未加载时先 ensureLoaded 再筛选', async () => {
    state.catalogLoaded = false
    state.ensureLoaded = () => {
      state.catalogLoaded = true
    }
    expect(await filterCustom.apply(markers, { typeIds: [1] }, ctx)).toEqual([
      markers[0],
      markers[1],
    ])
  })

  it('目录加载失败时返回空（避免误显示全量点位）', async () => {
    state.catalogLoaded = false
    state.ensureLoaded = () => {}
    expect(await filterCustom.apply(markers, { typeIds: [1] }, ctx)).toEqual([])
  })
})
