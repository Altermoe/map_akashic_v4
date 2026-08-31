import type { MarkerThin } from './index'
import type { MarkerIndex } from './indexMapCodec'

/**
 * 多分页解码结果的合并（纯函数，供 store 与单测使用）。
 *
 * 每个分页二进制独立解码为各自的部分 thin 列表与倒排索引；这里按 marker id 追加 thin，
 * 并对 itemMarkerIndex / iconMarkerIndex 做 Set 并集（key=itemId/iconId，value=marker id 集合）。
 * 由于 marker id 全局唯一，且同一 item/icon 可能出现在多个分页，故索引必须 union 而非覆盖。
 */
export interface DecodedPage {
  thinList: MarkerThin[]
  itemMarkerIndex: MarkerIndex
  iconMarkerIndex: MarkerIndex
}

export interface MergedMarkerData {
  thinList: MarkerThin[]
  itemMarkerIndex: MarkerIndex
  iconMarkerIndex: MarkerIndex
}

export const emptyMergedMarkerData = (): MergedMarkerData => ({
  thinList: [],
  itemMarkerIndex: new Map(),
  iconMarkerIndex: new Map(),
})

export const mergeDecodedPages = (pages: DecodedPage[]): MergedMarkerData => {
  const thinList: MarkerThin[] = []
  const itemMarkerIndex: MarkerIndex = new Map()
  const iconMarkerIndex: MarkerIndex = new Map()

  const mergeIndex = (target: MarkerIndex, pageIndex: MarkerIndex) => {
    for (const [key, markerSet] of pageIndex) {
      let targetSet = target.get(key)
      if (!targetSet) {
        targetSet = new Set()
        target.set(key, targetSet)
      }
      for (const id of markerSet) targetSet.add(id)
    }
  }

  for (const page of pages) {
    thinList.push(...page.thinList)
    mergeIndex(itemMarkerIndex, page.itemMarkerIndex)
    mergeIndex(iconMarkerIndex, page.iconMarkerIndex)
  }

  return { thinList, itemMarkerIndex, iconMarkerIndex }
}
