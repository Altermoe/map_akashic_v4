import { describe, expect, it } from 'vitest'
import type { MarkerThin } from './index'
import { mergeDecodedPages, type DecodedPage } from './merge'

const page = (
  thinList: MarkerThin[],
  item: Record<number, number[]>,
  icon: Record<number, number[]>,
): DecodedPage => ({
  thinList,
  itemMarkerIndex: new Map(Object.entries(item).map(([k, v]) => [Number(k), new Set(v)])),
  iconMarkerIndex: new Map(Object.entries(icon).map(([k, v]) => [Number(k), new Set(v)])),
})

const marker = (id: number, itemIds: number[], icon: string): MarkerThin => ({
  id,
  name: `m${id}`,
  pos: [id, id],
  icon,
  isOverlay: false,
  itemIds,
})

describe('mergeDecodedPages', () => {
  it('多分页 thin 列表顺序拼接，索引按 itemId/iconId 求并集', () => {
    const p1 = page(
      [marker(1, [100, 200], '501'), marker(2, [200], '502')],
      { 100: [1], 200: [1, 2] },
      { 501: [1], 502: [2] },
    )
    const p2 = page([marker(3, [100, 300], '501')], { 100: [3], 300: [3] }, { 501: [3] })

    const merged = mergeDecodedPages([p1, p2])

    expect(merged.thinList.map((m) => m.id)).toEqual([1, 2, 3])
    // 同一 itemId 跨页累积，marker id 并集去重
    expect(merged.itemMarkerIndex.get(100)).toEqual(new Set([1, 3]))
    expect(merged.itemMarkerIndex.get(200)).toEqual(new Set([1, 2]))
    expect(merged.itemMarkerIndex.get(300)).toEqual(new Set([3]))
    // icon 索引同理并集
    expect(merged.iconMarkerIndex.get(501)).toEqual(new Set([1, 3]))
    expect(merged.iconMarkerIndex.get(502)).toEqual(new Set([2]))
  })

  it('空分页合并得到空数据', () => {
    const merged = mergeDecodedPages([])
    expect(merged.thinList).toEqual([])
    expect(merged.itemMarkerIndex.size).toBe(0)
    expect(merged.iconMarkerIndex.size).toBe(0)
  })

  it('同一分页内重复 marker id 在索引中自动去重（Set 语义）', () => {
    const single = page([marker(1, [100], '501')], { 100: [1, 1, 1] }, { 501: [1, 1] })
    const merged = mergeDecodedPages([single])
    expect(merged.itemMarkerIndex.get(100)).toEqual(new Set([1]))
    expect(merged.iconMarkerIndex.get(501)).toEqual(new Set([1]))
  })
})
