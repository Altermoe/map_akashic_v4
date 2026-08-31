import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkerThin } from '@/stores/marker'
import type { FilterContext } from './index'

const state = vi.hoisted(() => ({
  itemMarkerIndex: new Map<number, Set<string>>(),
}))

// 只测 filter-basic 的集合逻辑，用受控 fake 替换 useMarkerStore 的反查索引（seam Provider 替换）。
// 同时 mock item-catalog：filter-impls 入口会把 filter-custom 一并拉入（其依赖 item-catalog → Api → navigator，node 下不可用）。
vi.mock('@/stores/marker', () => ({
  useMarkerStore: () => ({ itemMarkerIndex: state.itemMarkerIndex }),
}))
vi.mock('@/stores/item-catalog', () => ({
  useItemCatalogStore: () => ({ loaded: true, ensureLoaded: () => {}, typeItemIds: new Map() }),
}))

import { filterBasic } from './filter-basic'

const ctx: FilterContext = {
  signal: new AbortController().signal,
  progress: () => {},
  pipeline: ['basic'],
}

const markers: MarkerThin[] = [
  { id: 1, name: 'A', icon: '1', pos: [0, 0], isOverlay: false, itemIds: [10] },
  { id: 2, name: 'B', icon: '2', pos: [1, 1], isOverlay: false, itemIds: [20, 30] },
  { id: 3, name: 'C', icon: '3', pos: [2, 2], isOverlay: false, itemIds: [] },
]

const indexOf = (pairs: [number, string[]][]): Map<number, Set<string>> =>
  new Map(pairs.map(([k, v]) => [k, new Set(v)]))

beforeEach(() => {
  state.itemMarkerIndex = indexOf([
    [10, ['a']],
    [20, ['b']],
    [30, ['b']],
  ])
})

describe('filterBasic（物品筛选，反查索引求并集）', () => {
  it('单个物品 id 命中对应点位', () => {
    expect(filterBasic.apply(markers, { itemIds: [10] }, ctx)).toEqual([markers[0]])
  })

  it('多物品 id 求并集，且保持输入顺序', () => {
    state.itemMarkerIndex = indexOf([
      [10, ['a']],
      [20, ['b']],
    ])
    expect(filterBasic.apply(markers, { itemIds: [10, 20] }, ctx)).toEqual([markers[0], markers[1]])
  })

  it('空选中列表返回空（不展示全量）', () => {
    expect(filterBasic.apply(markers, { itemIds: [] }, ctx)).toEqual([])
  })

  it('没有命中任何点的物品 id 返回空', () => {
    expect(filterBasic.apply(markers, { itemIds: [99] }, ctx)).toEqual([])
  })

  it('反查索引里无该 id（未建立）时静默跳过', () => {
    state.itemMarkerIndex = new Map()
    expect(filterBasic.apply(markers, { itemIds: [10] }, ctx)).toEqual([])
  })
})
