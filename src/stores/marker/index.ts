import { useRequest } from 'alova/client'
import { defineStore } from 'pinia'
import Api from '@/api'
import { useAsyncStore } from '@/stores/async'
// oxlint-disable-next-line import/default
import markerStateWorkerUrl from '@/stores/marker/decode.worker?worker&url'
import type { MarkerDecodeOutput, MarkerDecodeInput } from '@/stores/marker/decode.worker'
import { invokeWorker } from '@/utils/worker'

export interface MarkerThin {
  /** 点位 id */
  id: string
  /** 点位名称 */
  name: string
  /** 用于地图点位渲染的主图标 id */
  icon: string
  /** 点位地图坐标 */
  pos: readonly [x: number, y: number]
  /** 点位是否处于附加层级 */
  isOverlay: boolean
  /** 该点位关联的物品 id 列表（从 itemList 提取，用于物品筛选） */
  itemIds: readonly number[]
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
  const asyncStore = useAsyncStore()

  const {
    data,
    loading,
    downloading,
    abort: abortRequest,
    onSuccess: onRequestSuccess,
    onError: onRequestError,
  } = useRequest(Api.main.marker_doc.listMarkersByBinary(), {
    initialData: {
      markers: [],
      users: {},
    },
  })

  // 将请求过程接入 useAsyncStore：loading 触发时创建任务，downloading 汇报进度，
  // onSuccess / onError 完成或失败任务，用户在 Popover 中取消时中断请求。
  let requestTaskId: string | null = null

  const clearRequestTask = () => {
    requestTaskId = null
  }

  watch(
    loading,
    (value) => {
      if (!value) return
      if (requestTaskId) return
      const controller = new AbortController()
      controller.signal.addEventListener(
        'abort',
        () => {
          abortRequest()
        },
        { once: true },
      )
      requestTaskId = asyncStore.create({
        title: '加载点位数据',
        cancellable: true,
        controller,
      })
    },
    { immediate: true },
  )

  watch(downloading, (progress) => {
    if (!requestTaskId) return
    const { loaded, total } = progress
    if (total > 0) {
      asyncStore.update(requestTaskId, {
        progress: loaded / total,
        message: `${loaded} / ${total} bytes`,
      })
    }
  })

  onRequestSuccess(() => {
    if (!requestTaskId) return
    asyncStore.finish(requestTaskId)
    clearRequestTask()
  })

  onRequestError((event) => {
    if (!requestTaskId) return
    asyncStore.fail(requestTaskId, event.error)
    clearRequestTask()
  })

  const indexList = shallowRef<MarkerThin[]>([])

  /** 反查索引：itemId -> 包含该物品的 marker id 集合，供 filter 高效查询 */
  const itemMarkerIndex = computed(() => {
    const index = new Map<number, Set<string>>()
    for (const marker of indexList.value) {
      if (!marker.itemIds) continue
      for (const itemId of marker.itemIds) {
        let set = index.get(itemId)
        if (!set) {
          set = new Set()
          index.set(itemId, set)
        }
        set.add(marker.id)
      }
    }
    return index
  })

  let currentController: AbortController | null = null

  watch(
    () => data.value,
    async (value) => {
      currentController?.abort()

      const markerData = toRaw(value)
      if (!markerData || !(markerData instanceof ArrayBuffer)) {
        indexList.value = []
        return
      }

      const controller = new AbortController()
      currentController = controller

      try {
        const res = await asyncStore.run(
          async ({ progress, signal }) =>
            invokeWorker<MarkerDecodeInput, MarkerDecodeOutput>(ensureWorker(), markerData, {
              timeout: 30_000,
              transfer: [markerData],
              signal,
              onProgress: (value, message) => progress(value, message),
            }),
          {
            title: '解码点位数据',
            controller,
          },
        )
        if (controller.signal.aborted) return
        indexList.value = res
      } catch {
        if (controller.signal.aborted) return
        indexList.value = []
      } finally {
        if (currentController === controller) currentController = null
      }
    },
    { immediate: true },
  )

  return {
    indexList: indexList as Readonly<ShallowRef<MarkerThin[]>>,
    itemMarkerIndex,
  }
})
