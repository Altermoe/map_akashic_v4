import { kongying } from '@/protobuf'
import type { MarkerThin } from './index'

/**
 * 将 `MarkerVoList` protobuf 二进制瘦身为渲染/筛选所需的 `MarkerThin[]`。
 *
 * 纯函数，供 decode.worker（transport）在 worker 内调用，也直接可在 node 测试环境
 * 用 golden data 回归。数据流不绕行：这里只做「解码 → 六字段瘦身」，
 * 仍是架构红线段落（API → worker 解码 → store）的固定环节。
 */
export const decodeMarkerList = (bytes: Uint8Array): MarkerThin[] => {
  const { markers } = kongying.MarkerVoList.decode(bytes)
  const { length } = markers
  const thinList: MarkerThin[] = Array.from({ length: length })
  const toNum = (v: number | { toNumber(): number } | null | undefined): number | undefined => {
    if (v == null) return undefined
    return typeof v === 'number' ? v : v.toNumber()
  }
  for (let i = 0; i < length; i++) {
    const markerInfo = markers[i] as kongying.MarkerVo
    const [sx, sy] = markerInfo.position.split(',')
    const itemList = markerInfo.itemList
    thinList[i] = {
      id: markerInfo.id.toNumber(),
      name: markerInfo.markerTitle,
      pos: [Number(sx), Number(sy)],
      icon: `${toNum(itemList?.[0]?.iconId) ?? -1}`,
      isOverlay: markerInfo.extra?.underground?.isUnderground ?? false,
      itemIds: itemList
        ? itemList.map((item) => toNum(item.itemId)).filter((id): id is number => id !== undefined)
        : [],
    }
  }
  return thinList
}
