import { handleRequest } from '@/utils/worker'
import { decodeMarkerList } from './decode'
import type { MarkerThin } from './index'
import { encodeIndex } from './indexMapCodec'
import type { EncodedMarkerIndex } from './indexMapCodec'

export type MarkerDecodeInput = ArrayBuffer
export type MarkerDecodeOutput = {
  thinList: MarkerThin[]
  itemMarkerIndex: EncodedMarkerIndex
  iconMarkerIndex: EncodedMarkerIndex
}

handleRequest<MarkerDecodeInput, MarkerDecodeOutput>(({ data, send }) => {
  const { thinList, itemMarkerIndex, iconMarkerIndex } = decodeMarkerList(new Uint8Array(data))
  // Map/Set 无法走结构化克隆零拷贝，编码为可转移的 Int32Array 后随响应一并 transfer。
  const item = encodeIndex(itemMarkerIndex)
  const icon = encodeIndex(iconMarkerIndex)
  send({ thinList, itemMarkerIndex: item, iconMarkerIndex: icon }, [
    item.keys.buffer,
    item.values.buffer,
    icon.keys.buffer,
    icon.values.buffer,
  ])
})
