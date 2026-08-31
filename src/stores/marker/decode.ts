import type { MarkerItemLinkVo, MarkerVo } from '@/api/services/main/globals'
import type { MarkerThin } from './index'

interface DecodeResult {
  thinList: MarkerThin[]
  itemMarkerIndex: Map<number, Set<number>>
  iconMarkerIndex: Map<number, Set<number>>
  errors: string[]
}

const EMPTY_ITEM_LIST: MarkerItemLinkVo[] = []

/**
 * 将 `MarkerVo[]` 瘦身为渲染/筛选所需的 `MarkerThin[]`，
 * 并返回必须的倒排索引表。
 *
 * ### 入参
 * bytes: 二进制编码的 json 文本
 *
 * 纯函数，供 decode.worker（transport）在 worker 内调用，也直接可在 node 测试环境
 * 用 golden data 回归。数据流不绕行：这里只做「解码 → 六字段瘦身」，
 * 仍是架构红线段落（API → worker 解码 → store）的固定环节。
 */
export const decodeMarkerList = (bytes: Uint8Array): DecodeResult => {
  /** 物品 → 点位表 */
  const itemMarkerIndex = new Map<number, Set<number>>()
  /** 图标 → 点位表 */
  const iconMarkerIndex = new Map<number, Set<number>>()
  /** 错误消息 */
  const errors: string[] = []

  try {
    // 解码
    const jsonDecoder = new TextDecoder('utf8')
    const json = jsonDecoder.decode(bytes)
    const markers = JSON.parse(json) as MarkerVo[]

    // 瘦身
    const { length } = markers
    const thinList: MarkerThin[] = Array.from({ length: length })
    const toNum = (v: number | { toNumber(): number } | null | undefined): number | undefined => {
      if (v == null) return undefined
      return typeof v === 'number' ? v : v.toNumber()
    }

    for (let i = 0; i < length; i++) {
      const markerInfo = markers[i]
      if (!markerInfo.id) {
        errors.push(`markerList[${i}].id is undefined`)
        continue
      }
      const markerId = markerInfo.id
      if (!markerInfo.markerTitle) {
        errors.push(`Marker(${markerId}).markerTitle is undefined`)
        continue
      }
      if (!markerInfo.position) {
        errors.push(`Marker(${markerId}).position is undefined`)
        continue
      }
      if (!markerInfo.itemList) {
        errors.push(`Marker(${markerId}).itemList is undefined`)
        continue
      }
      const [sx, sy] = markerInfo.position
      const itemList = markerInfo.itemList
      const itemIds: number[] = []
      const { length: itemLength } = itemList ?? EMPTY_ITEM_LIST
      for (let j = 0; j < itemLength; j++) {
        const item = itemList[j]
        if (!item.itemId) {
          errors.push(`Marker(${markerId}).itemList[${j}].itemId is undefined`)
          continue
        }
        if (!item.iconId) {
          errors.push(`Marker(${markerId}).itemList[${j}].iconId is undefined`)
          continue
        }
        const itemId = item.itemId
        const iconId = item.iconId
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
        isOverlay: markerInfo.extra?.underground?.is_underground ?? false,
        itemIds: itemIds,
      }
    }

    return {
      thinList,
      itemMarkerIndex,
      iconMarkerIndex,
      errors,
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `${error}`)
    return {
      thinList: [],
      itemMarkerIndex,
      iconMarkerIndex,
      errors,
    }
  }
}
