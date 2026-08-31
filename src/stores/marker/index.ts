import { useSerialRequest } from 'alova/client'
import { acceptHMRUpdate, defineStore } from 'pinia'
import Api from '@/api'
import type { BinaryMD5Vo } from '@/api/services/main/globals'
import { useAsyncStore } from '@/stores/async'
import { MANIFEST_TTL, MARKER_NAMESPACE, markerCache } from '@/stores/marker/cache'
// oxlint-disable-next-line import/default
import markerStateWorkerUrl from '@/stores/marker/decode.worker?worker&url'
import type { MarkerDecodeOutput, MarkerDecodeInput } from '@/stores/marker/decode.worker'
import { decodeIndex } from '@/stores/marker/indexMapCodec'
import { mergeDecodedPages } from '@/stores/marker/merge'
import { invokeWorker } from '@/utils/worker'
export interface MarkerThin {
  /** 点位 id */
  id: number
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

const EMPTY_MARKER_LIST: MarkerThin[] = []
const EMPTY_MARKER_INDEX = new Map<number, Set<number>>()

/** 分页并发拉取的窗口大小 */
const PAGE_FETCH_CONCURRENCY = 4

export const useMarkerStore = defineStore('item', () => {
  const asyncStore = useAsyncStore()

  // —— MD5 清单：先取清单这一固定串行环节，用 useSerialRequest 锚定（immediate 关闭，由 run 手动驱动）。
  const manifestRequest = useSerialRequest([() => Api.main.marker_doc.listMarkerBinaryMD5()], {
    immediate: false,
  })

  const indexList = shallowRef<MarkerThin[]>(EMPTY_MARKER_LIST)
  /** 反查索引：itemId -> 包含该物品的 marker id 集合 */
  const itemMarkerIndex = shallowRef<Map<number, Set<number>>>(EMPTY_MARKER_INDEX)
  /** 反查索引：itemId -> 包含该图标的 marker id 集合 */
  const iconMarkerIndex = shallowRef<Map<number, Set<number>>>(EMPTY_MARKER_INDEX)

  /** 已启动标识，避免并发多次触发全量加载 */
  let started = false

  /**
   * 受控加载：MD5 清单（先查缓存，未过期直接复用；否则拉远程并写缓存）
   * → 并发拉取缺失分页 → 全部有效分页整体重解码 → 合并索引。
   */
  const load = async (force = false) => {
    const taskController = new AbortController()
    taskController.signal.addEventListener('abort', () => manifestRequest.abort(), { once: true })

    // 记录本批已发出的分页 Method，取消时逐一 abort
    const pendingMethods: Array<{ abort(): void }> = []

    try {
      await asyncStore.run(
        async ({ progress, signal }) => {
          if (signal.aborted) return

          // 1) MD5 清单
          let manifest: BinaryMD5Vo[] = []
          const cachedManifest = await markerCache.readManifest()
          const manifestFresh =
            !force &&
            !!cachedManifest?.list?.length &&
            Date.now() - cachedManifest!.fetchedAt < MANIFEST_TTL
          if (manifestFresh) {
            manifest = cachedManifest!.list
          } else {
            progress(0, '获取带内点位清单')
            const res = await manifestRequest.send(true)
            manifest = res?.data ?? []
            await markerCache.writeManifest(manifest)
          }

          if (signal.aborted) return
          if (manifest.length === 0) {
            indexList.value = EMPTY_MARKER_LIST
            itemMarkerIndex.value = EMPTY_MARKER_INDEX
            iconMarkerIndex.value = EMPTY_MARKER_INDEX
            return
          }

          // 2) 确认清单及其全部合法分页 key（供后续清理历史缓存）
          const validPageKeys: string[] = manifest.map((p) => pageCacheKey(p))

          // 3) 并发拉取缺失分页（单页失败重试一次，仍失败视为 partial：跳过该页并保留其余结果）
          const fetched = new Array<ArrayBuffer>(manifest.length)
          let pullCount = 0
          const failedPages: string[] = []
          const fetchPage = async (page: BinaryMD5Vo) => {
            const method = Api.main.marker_doc.listPageMarkerByBinary({
              pathParams: { md5: page.md5! },
            })
            pendingMethods.push(method)
            try {
              const buf = (await method.send(true)) as ArrayBuffer
              await markerCache.writePage(page.md5!, page.time!, buf)
              return buf
            } catch {
              // 抛出的可能是 abort 造成的错误，需要重新抛出以中断，其余静默跳过
              if (taskController.signal.aborted) throw taskController.signal.reason
              pendingMethods.splice(pendingMethods.indexOf(method), 1)
              throw new Error(`点位分片拉取失败: ${page.md5}`)
            }
          }
          const pullOne = async (idx: number) => {
            const page = manifest[idx]
            const cachedBuf = await markerCache.readPage(page.md5!, page.time!)
            if (cachedBuf !== null) {
              fetched[idx] = cachedBuf
              return
            }
            try {
              fetched[idx] = await fetchPage(page)
            } catch {
              if (taskController.signal.aborted) throw taskController.signal.reason
              try {
                fetched[idx] = await fetchPage(page) // 一次重试
              } catch {
                if (taskController.signal.aborted) throw taskController.signal.reason
                failedPages.push(page.md5!)
              }
            } finally {
              pullCount++
              progress(
                pullCount / manifest.length,
                `拉取点位分片 ${pullCount} / ${manifest.length}`,
              )
            }
          }
          await runConcurrent(
            manifest.map((_, i) => i),
            PAGE_FETCH_CONCURRENCY,
            (idx) => pullOne(idx),
          )

          if (signal.aborted) return

          // 4) 全部有效分页整体重解码（倒排索引由当前数据重新计算，不缓存解码结果）
          const decodedPages = []
          for (let i = 0; i < manifest.length; i++) {
            if (signal.aborted) return
            progress((i + 1) / manifest.length, `解码点位分片 ${i + 1} / ${manifest.length}`)
            const buffer = fetched[i]
            if (!(buffer instanceof ArrayBuffer)) continue
            // 缓存读出的 buffer 不可转移（会 detach dexie 里的副本），统一复制一份再 transfer
            const transferable = buffer.slice(0)
            const res = await invokeWorker<MarkerDecodeInput, MarkerDecodeOutput>(
              ensureWorker(),
              transferable,
              {
                transfer: [transferable],
                signal,
              },
            ).catch((error) => {
              console.error('解码失败', error)
              return null
            })
            if (!res) continue
            decodedPages.push({
              thinList: res.thinList,
              itemMarkerIndex: decodeIndex(res.itemMarkerIndex),
              iconMarkerIndex: decodeIndex(res.iconMarkerIndex),
            })
          }

          const merged = mergeDecodedPages(decodedPages)
          indexList.value = merged.thinList
          itemMarkerIndex.value = merged.itemMarkerIndex
          iconMarkerIndex.value = merged.iconMarkerIndex
          if (failedPages.length > 0) {
            progress(1, `部分点位分片加载失败: ${failedPages.join(', ')}`)
          }

          // 5) 清理不再被清单引用的历史分页缓存
          await markerCache.purgeStalePages(new Set(validPageKeys))
        },
        {
          title: '加载点位数据',
          controller: taskController,
        },
      )
    } finally {
      // 尚未发出的分页请求在超时/异常/取消时中止
      for (const method of pendingMethods) method.abort()
    }
  }

  /** 启动一次加载（store 首次实例化时自动触发） */
  const start = () => {
    if (started) return
    started = true
    load()
  }
  start()

  return {
    indexList: indexList as Readonly<ShallowRef<MarkerThin[]>>,
    itemMarkerIndex: itemMarkerIndex as Readonly<ShallowRef<Map<number, Set<number>>>>,
    iconMarkerIndex: iconMarkerIndex as Readonly<ShallowRef<Map<number, Set<number>>>>,
    /** 手动触发刷新（跳过 MD5 清单缓存） */
    refresh: () => load(true),
  }
})

const pageCacheKey = (page: BinaryMD5Vo) => `${MARKER_NAMESPACE}:page:${page.md5}:${page.time}`

/** 简单并发窗口执行器：处理 index 数组，窗口内并发，全部完成返回 */
const runConcurrent = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) => {
  let next = 0
  const runners: Promise<void>[] = []
  const max = Math.min(items.length, concurrency)
  for (let i = 0; i < max; i++) {
    runners.push(
      (async () => {
        while (next < items.length) {
          const idx = next++
          await worker(items[idx])
        }
      })(),
    )
  }
  await Promise.all(runners)
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMarkerStore, import.meta.hot))
}
