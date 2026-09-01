import { describe, expect, it } from 'vitest'
import type { MarkerVo } from '@/api/services/main/globals'
import { decodeMarkerList } from './decode'
import type { MarkerThin } from './index'

/**
 * decodeMarkerList golden data：固定构造 MarkerVo[] → 以 API transform 解压后的 JSON 文本字节喂入 → 解码瘦身。
 * （分页接口 list_page_bin/{md5} 实测返回 gzip JSON MarkerVo[]，已在 API transform 用
 * DecompressionStream 解压为原始 JSON 字节，本测试用 TextEncoder 模拟该解压结果；
 * 同一函数在 decode.worker 内作为 transport 调用，行为一致。见 KI-12 定夺）
 */
const encode = (markers: MarkerVo[]): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(markers))

/** 分页接口 JSON 中 position 为字符串 '<float>,<float>'（实测 page0 2991/2991 全为字符串） */
const markers: MarkerVo[] = [
  {
    id: 1001,
    markerTitle: '风神瞳',
    position: '32.5,41.2',
    hiddenFlag: 0,
    itemList: [{ iconId: 501, itemId: 2001, count: 1 }],
    extra: { underground: { is_underground: false } },
  },
  {
    id: 1002,
    markerTitle: '蒲公英',
    position: '10,20',
    hiddenFlag: 0,
    itemList: [
      { iconId: 502, itemId: 2002, count: 1 },
      { iconId: 503, itemId: 2003, count: 1 },
    ],
    extra: { underground: { is_underground: true } },
  },
  {
    id: 1003,
    markerTitle: '无物品列表',
    position: '0,0',
    hiddenFlag: 0,
    itemList: [],
  },
]

const norm = (m: MarkerThin): unknown => ({
  id: m.id,
  name: m.name,
  pos: [...m.pos],
  icon: m.icon,
  isOverlay: m.isOverlay,
  itemIds: [...m.itemIds],
})

describe('decodeMarkerList', () => {
  it('将分页 JSON 二进制瘦身为 MarkerThin[]（golden）', () => {
    const out = decodeMarkerList(encode(markers))

    expect(out.thinList.map(norm)).toEqual([
      {
        id: 1001,
        name: '风神瞳',
        pos: [32.5, 41.2],
        icon: '501',
        isOverlay: false,
        itemIds: [2001],
      },
      {
        id: 1002,
        name: '蒲公英',
        pos: [10, 20],
        icon: '502',
        isOverlay: true,
        itemIds: [2002, 2003],
      },
      { id: 1003, name: '无物品列表', pos: [0, 0], icon: '-1', isOverlay: false, itemIds: [] },
    ])
    expect(out.errors).toEqual([])
    // 倒排索引同步生成，marker/item/icon id 均为 number
    expect(out.itemMarkerIndex).toEqual(
      new Map([
        [2001, new Set([1001])],
        [2002, new Set([1002])],
        [2003, new Set([1002])],
      ]),
    )
    expect(out.iconMarkerIndex).toEqual(
      new Map([
        [501, new Set([1001])],
        [502, new Set([1002])],
        [503, new Set([1002])],
      ]),
    )
  })

  it('空列表返回空 thinList', () => {
    const out = decodeMarkerList(encode([]))
    expect(out.thinList).toEqual([])
    expect(out.errors).toEqual([])
  })

  it('非法二进制（非 JSON）上报错误并返回空结果', () => {
    const out = decodeMarkerList(new TextEncoder().encode('not-a-json'))
    expect(out.thinList).toEqual([])
    expect(out.errors).toHaveLength(1)
  })
})
