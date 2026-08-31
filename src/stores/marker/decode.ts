import { kongying } from '@/protobuf'
import type { MarkerThin } from './index'

interface DecodeResult {
  thinList: MarkerThin[]
  itemMarkerIndex: Map<number, Set<number>>
  iconMarkerIndex: Map<number, Set<number>>
}

const EMPTY_ITEM_LIST: kongying.MarkerItemLinkVo.$Properties[] = []

/**
 * 将 `MarkerVoList` protobuf 二进制瘦身为渲染/筛选所需的 `MarkerThin[]`，
 * 并返回必须的倒排索引表。
 *
 * 纯函数，供 decode.worker（transport）在 worker 内调用，也直接可在 node 测试环境
 * 用 golden data 回归。数据流不绕行：这里只做「解码 → 六字段瘦身」，
 * 仍是架构红线段落（API → worker 解码 → store）的固定环节。
 */
export const decodeMarkerList = (bytes: Uint8Array): DecodeResult => {
  // 解码
  const { markers } = kongying.MarkerVoList.decode(bytes)

  // 瘦身
  const { length } = markers
  const thinList: MarkerThin[] = Array.from({ length: length })
  const toNum = (v: number | { toNumber(): number } | null | undefined): number | undefined => {
    if (v == null) return undefined
    return typeof v === 'number' ? v : v.toNumber()
  }

  // 倒排索引

  /** 物品 → 点位表 */
  const itemMarkerIndex = new Map<number, Set<number>>()
  /** 图标 → 点位表 */
  const iconMarkerIndex = new Map<number, Set<number>>()

  for (let i = 0; i < length; i++) {
    const markerInfo = markers[i] as kongying.MarkerVo
    const [sx, sy] = markerInfo.position.split(',')
    const itemList = markerInfo.itemList
    const markerId = markerInfo.id.toNumber() as number
    const itemIds: number[] = []
    const { length: itemLength } = itemList ?? EMPTY_ITEM_LIST
    for (let j = 0; j < itemLength; j++) {
      const item = itemList[j]
      const itemId = item.itemId.toNumber() as number
      const iconId = item.iconId.toNumber() as number
      itemIds.push(itemId)
      if (!itemMarkerIndex.has(itemId)) {
        itemMarkerIndex.set(itemId, new Set())
      }
      itemMarkerIndex.get(itemId)!.add(markerId)
      if (!iconMarkerIndex.has(iconId)) {
        iconMarkerIndex.set(iconId, new Set())
      }
      iconMarkerIndex.get(iconId)!.add(markerId)
    }
    thinList[i] = {
      id: markerId,
      name: markerInfo.markerTitle,
      pos: [Number(sx), Number(sy)],
      icon: `${toNum(itemList?.[0]?.iconId) ?? -1}`,
      isOverlay: markerInfo.extra?.underground?.isUnderground ?? false,
      itemIds: itemIds,
    }
  }

  return {
    thinList,
    itemMarkerIndex,
    iconMarkerIndex,
  }
}
