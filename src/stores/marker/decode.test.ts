import { describe, expect, it } from 'vitest'
import { kongying } from '@/protobuf'
import { decodeMarkerList } from './decode'
import type { MarkerThin } from './index'

/**
 * decodeMarkerList golden data：固定构造 MarkerVoList → protobuf 编码 → 解码瘦身。
 * 断言的是六字段瘦身结果：无序二进制 → 结构化 MarkerThin[]。
 * （protobufjs 是纯 JS，node 环境直接跑；同一函数在 decode.worker 内作为 transport 调用，行为一致）
 */
const encode = (markers: kongying.MarkerVo.$Properties[]): Uint8Array =>
  kongying.MarkerVoList.encode({ markers }).finish()

const norm = (m: MarkerThin): unknown => ({
  id: m.id,
  name: m.name,
  pos: [...m.pos],
  icon: m.icon,
  isOverlay: m.isOverlay,
  itemIds: [...m.itemIds],
})

describe('decodeMarkerList', () => {
  it('将 MarkerVoList protobuf 二进制瘦身为 MarkerThin[]（golden）', () => {
    const bytes = encode([
      {
        id: 1001,
        markerTitle: '风神瞳',
        position: '32.5,41.2',
        hiddenFlag: 0,
        itemList: [{ iconId: 501, itemId: 2001, count: 1 }],
        extra: { underground: { isUnderground: false } },
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
        extra: { underground: { isUnderground: true } },
      },
      {
        id: 1003,
        markerTitle: '无物品列表',
        position: '0,0',
        hiddenFlag: 0,
        itemList: [],
      },
    ])

    const out = decodeMarkerList(bytes)

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
  })

  it('空列表返回空数组', () => {
    expect(decodeMarkerList(encode([]))).toEqual([])
  })
})
