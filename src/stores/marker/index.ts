import { computedAsync } from '@vueuse/core'
import { useRequest } from 'alova/client'
import { defineStore } from 'pinia'
import Api from '@/api'
// oxlint-disable-next-line import/default
import markerStateWorkerUrl from '@/stores/marker/decode.worker?worker&url'
import type { MarkerDecodeOutput, MarkerDecodeInput } from '@/stores/marker/decode.worker'
import { invokeWorker } from '@/utils/worker'

export interface MarkerThin {
  id: string
  name: string
  pos: readonly [x: number, y: number]
}

let worker: Worker | null = null

const ensureWorker = () => {
  if (!worker) {
    worker = new Worker(markerStateWorkerUrl, {
      type: 'module',
      name: 'marker-data-decoder',
    })
  }
  return worker
}

export const useMarkerStore = defineStore('item', () => {
  const { data } = useRequest(Api.main.marker_doc.listMarkersByBinary(), {
    initialData: {
      markers: [],
      users: {},
    },
  })

  const indexList = computedAsync(async (onCancel) => {
    const markerData = toRaw(data.value)
    if (!markerData || !(markerData instanceof ArrayBuffer)) return []
    let expried = false
    onCancel(() => {
      expried = true
    })
    const worker = ensureWorker()
    const res = await invokeWorker<MarkerDecodeInput, MarkerDecodeOutput>(worker, markerData, {
      timeout: 30_000,
      transfer: [markerData],
    })
    if (expried) return []
    return res
  }, [])

  return {
    indexList: indexList as Readonly<ShallowRef<MarkerThin[]>>,
  }
})
