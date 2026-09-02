import { describe, expect, it, vi } from 'vitest'
import type { MarkerThin } from '@/stores/marker'
import type { FilterContext } from '@/stores/filter/filter-impls'

// filterSearch 本身是纯函数，但 filter-impls 入口会把 filter-basic/custom 一并拉入，
// 其依赖 marker/item-catalog store → Api → navigator.storage（node 下不可用），故需 seam mock 掉。
vi.mock('@/stores/marker', () => ({
  useMarkerStore: () => ({ itemMarkerIndex: new Map<number, Set<string>>() }),
}))
vi.mock('@/stores/item-catalog', () => ({
  useItemCatalogStore: () => ({ loaded: true, ensureLoaded: () => {}, typeItemIds: new Map() }),
}))

import { filterSearch } from '@/stores/filter/filter-impls/filter-search'

const ctx: FilterContext = {
  signal: new AbortController().signal,
  progress: () => {},
  pipeline: ['search'],
}

const markers: MarkerThin[] = [
  { id: 1, name: '风神瞳', icon: '1', pos: [0, 0], isOverlay: false, itemIds: [10] },
  { id: 2, name: '蒲公英', icon: '2', pos: [1, 1], isOverlay: false, itemIds: [20] },
  { id: 3, name: 'Wind Mill', icon: '3', pos: [2, 2], isOverlay: false, itemIds: [30] },
]

describe('filterSearch', () => {
  it('按名称子串匹配（大小写不敏感）', () => {
    expect(filterSearch.apply(markers, { keyword: '风' }, ctx)).toEqual([markers[0]])
    expect(filterSearch.apply(markers, { keyword: 'wind' }, ctx)).toEqual([markers[2]])
  })

  it('去掉首尾空白后再匹配', () => {
    expect(filterSearch.apply(markers, { keyword: '  蒲公英  ' }, ctx)).toEqual([markers[1]])
  })

  it('空关键字 / 纯空白返回原数组（不过滤）', () => {
    expect(filterSearch.apply(markers, { keyword: '' }, ctx)).toEqual(markers)
    expect(filterSearch.apply(markers, { keyword: '   ' }, ctx)).toEqual(markers)
  })

  it('无匹配返回空数组', () => {
    expect(filterSearch.apply(markers, { keyword: '不存在的名字' }, ctx)).toEqual([])
  })
})
