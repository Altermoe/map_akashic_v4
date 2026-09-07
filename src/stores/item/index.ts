import { useSerialRequest } from 'alova/client'
import { defineStore } from 'pinia'
import Api from '@/api'
import type { BinaryMD5Vo, ItemVo } from '@/api/services/main/globals'

const EMPTY_ITEM_LIST: ItemVo[] = []

/** 分页并发拉取的窗口大小 */
const PAGE_FETCH_CONCURRENCY = 4

/** 合并各分页 item 集合：按清单顺序 union，id 重复时保留先出现的条目 */
const mergeItemPages = (pages: (ItemVo[] | undefined)[]) => {
  const seen = new Set<number>()
  const merged: ItemVo[] = []
  const { length } = pages
  for (let i = 0; i < length; i++) {
    const page = pages[i]
    if (!page) continue
    for (let j = 0; j < page.length; j++) {
      const item = page[j]
      if (item.id == null || seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
  }
  return merged
}

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

export const useItemStore = defineStore('item', () => {
  // MD5 清单：固定串行环节用 useSerialRequest 锚定（immediate 关闭，由 load 手动驱动）。
  const manifestRequest = useSerialRequest([() => Api.main.item_doc.listItemBinaryMD5()], {
    immediate: false,
  })

  const list = shallowRef<ItemVo[]>(EMPTY_ITEM_LIST)
  const loading = ref(false)

  /** id 索引表 */
  const idMap = computed(() => {
    const map = new Map<number | undefined, ItemVo>()
    const items = list.value
    const { length } = items
    for (let i = 0; i < length; i++) {
      const item = items[i]
      map.set(item.id, item)
    }
    return map
  })

  let started = false

  /**
   * 受控加载：先取 MD5 清单 → 并发拉取各 md5 分页 → 合并 item 集合。
   * 清单请求强制刷新（保证拿到最新 md5）；分页 URL 以 md5 为 key，
   * 走 alova GET restore 缓存即可（内容变更必然带来 md5 变化，缓存天然失效）。
   */
  const load = async () => {
    loading.value = true
    try {
      const res = await manifestRequest.send(true)
      const pages: BinaryMD5Vo[] = res?.data ?? []
      if (pages.length === 0) {
        list.value = EMPTY_ITEM_LIST
        return
      }
      const fetched = new Array<ItemVo[]>(pages.length)
      const failedPages: string[] = []
      await runConcurrent(
        pages.map((_, i) => i),
        PAGE_FETCH_CONCURRENCY,
        async (idx) => {
          const page = pages[idx]
          try {
            // 单页失败记为 partial：跳过该页并保留其余结果
            fetched[idx] = (await Api.main.item_doc
              .listPageItemByBinary({ pathParams: { md5: page.md5! } })
              .send()) as ItemVo[]
          } catch {
            failedPages.push(page.md5!)
          }
        },
      )
      list.value = mergeItemPages(fetched)
      if (failedPages.length > 0) {
        console.warn(`部分物品分片加载失败: ${failedPages.join(', ')}`)
      }
    } finally {
      loading.value = false
    }
  }

  /** 启动一次加载（store 首次实例化时自动触发） */
  const start = () => {
    if (started) return
    started = true
    load().catch((error) => {
      console.error('加载物品数据失败', error)
    })
  }
  start()

  return {
    loading,
    list,
    idMap,
  }
})
