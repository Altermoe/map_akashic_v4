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
 * 坐标解码：把 `MarkerVo.position`（分页 JSON 实测为字符串 `"<float>,<float>"`）解析为数值对 `[x, y]`。
 * 解析不出两个有限数值时返回 null，由调用方按既有校验风格上报并跳过该点位，
 * 避免把 NaN/错位坐标静默写进渲染层。
 */
const decodePosition = (raw: string): readonly [x: number, y: number] | null => {
  const commaIndex = raw.indexOf(',')
  if (commaIndex < 0) return null
  const x = parseFloat(raw)
  if (Number.isNaN(x)) return null
  const y = parseFloat(raw.slice(commaIndex + 1))
  if (Number.isNaN(y)) return null
  return [x, y]
}

/**
 * 将分页二进制（API transform 已 gzip 解压的 JSON 文本字节）瘦身为
 * 渲染/筛选所需的 `MarkerThin[]`，并返回必须的倒排索引表。
 *
 * 分页接口 `list_page_bin/{md5}` 实测返回 gzip JSON `MarkerVo[]`（见 KI-12 定夺：
 * 全量接口加载过慢，分页是性能/缓存的正确选择，本解码只面向分页格式；
 * 全量接口 `list_markers` 为 protobuf，不在本模块职责内）。
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
    // 解码：gzip 解压后的 JSON 文本 → MarkerVo[]
    const json = new TextDecoder('utf8').decode(bytes)
    const markers = JSON.parse(json) as MarkerVo[]

    const { length } = markers
    const thinList: MarkerThin[] = Array.from({ length })

    for (let i = 0; i < length; i++) {
      const markerInfo = markers[i]
      const markerId = markerInfo.id
      // 必须属性校验
      if (!markerId) {
        errors.push(`markerList[${i}].id is undefined`)
        continue
      }
      if (!markerInfo.markerTitle) {
        errors.push(`Marker(${markerId}).markerTitle is undefined`)
        continue
      }
      if (!markerInfo.position) {
        errors.push(`Marker(${markerId}).position is undefined`)
        continue
      }
      const pos = decodePosition(markerInfo.position)
      if (pos === null) {
        errors.push(`Marker(${markerId}).position is invalid`)
        continue
      }
      const itemList = markerInfo.itemList ?? EMPTY_ITEM_LIST
      const isOverlay = markerInfo.extra?.underground?.is_underground ?? false
      const itemIds: number[] = []
      // 倒排索引
      for (let j = 0; j < itemList.length; j++) {
        const item = itemList[j]
        const itemId = item.itemId
        if (!itemId) {
          errors.push(`Marker(${markerId}).itemList[${j}].itemId is undefined`)
          continue
        }
        const iconId = item.iconId
        if (!iconId) {
          errors.push(`Marker(${markerId}).itemList[${j}].iconId is undefined`)
          continue
        }
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
        pos,
        icon: `${itemList[0]?.iconId ?? -1}`,
        isOverlay,
        itemIds,
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
