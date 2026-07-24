import { kongying } from '@/protobuf'
import { handleRequest } from '@/utils/worker'
import type { MarkerThin } from './index'

export type MarkerDecodeInput = ArrayBuffer
export type MarkerDecodeOutput = MarkerThin[]

handleRequest<MarkerDecodeInput, MarkerDecodeOutput>(({ data, send }) => {
  const { markers } = kongying.MarkerVoList.decode(new Uint8Array(data))
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
      icon: `${itemList?.[0].iconId.toNumber() ?? -1}`,
      isOverlay: markerInfo.extra?.underground?.isUnderground ?? false,
      itemIds: itemList
        ? itemList.map((item) => toNum(item.itemId)).filter((id): id is number => id !== undefined)
        : [],
    }
  }
  send(thinList)
})
