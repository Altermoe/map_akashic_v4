import { kongying } from '@/protobuf'
import { handleRequest } from '@/utils/worker'
import type { MarkerThin } from './index'

export type MarkerDecodeInput = ArrayBuffer
export type MarkerDecodeOutput = MarkerThin[]

handleRequest<MarkerDecodeInput, MarkerDecodeOutput>(({ data, send }) => {
  const { markers } = kongying.MarkerVoList.decode(new Uint8Array(data))
  const { length } = markers
  const thinList: MarkerThin[] = Array.from({ length: length })
  for (let i = 0; i < length; i++) {
    const markerInfo = markers[i] as kongying.MarkerVo
    const [sx, sy] = markerInfo.position.split(',')
    thinList[i] = {
      id: markerInfo.id.toNumber(),
      name: markerInfo.markerTitle,
      pos: [Number(sx), Number(sy)],
    }
  }
  send(thinList)
})
