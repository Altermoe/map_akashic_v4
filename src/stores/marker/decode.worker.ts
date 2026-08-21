import { handleRequest } from '@/utils/worker'
import { decodeMarkerList } from './decode'
import type { MarkerThin } from './index'

export type MarkerDecodeInput = ArrayBuffer
export type MarkerDecodeOutput = MarkerThin[]

handleRequest<MarkerDecodeInput, MarkerDecodeOutput>(({ data, send }) => {
  send(decodeMarkerList(new Uint8Array(data)))
})
