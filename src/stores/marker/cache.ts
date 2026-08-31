import type { Table } from 'dexie'
import type { BinaryMD5Vo } from '@/api/services/main/globals'
import { db } from '@/database'

/**
 * 点位分页加载的 dexie 缓存层。
 *
 * 只缓存「解码前」的原始二进制（按 md5+time key）与 MD5 清单，**不缓存解码后的
 * thin/倒排索引**——倒排索引始终由 worker 从当前分页集重新计算（避免旧索引复用腐化）。
 *
 * 设计要点：
 * - 复用 `db.kv` 表（与 `src/stores/icon` 的 CACHE_NAMESPACE 同模式），不改 Dexie schema/版本。
 * - 分页 key 形如 `marker:page:{md5}:{time}`，time 参与 key，天然区分同一 md5 的不同版本。
 * - dexie 读写失败统一 `try/catch` 降级为「未命中/写入静默跳过」，不阻塞加载主流程。
 */
export const MARKER_NAMESPACE = 'marker'

/** MD5 清单 TTL：在此窗口内复用清单，避免每次刷新都打 MD5 接口 */
export const MANIFEST_TTL = 30 * 60 * 1000

export interface MarkerManifestCache {
  list: BinaryMD5Vo[]
  fetchedAt: number
}

export interface MarkerCache {
  namespace: string
  /** 读取 MD5 清单；未命中或过期返回 null */
  readManifest(): Promise<MarkerManifestCache | null>
  /** 写入 MD5 清单（带当前时间戳） */
  writeManifest(list: BinaryMD5Vo[]): Promise<void>
  /** 读取某分页的解压后二进制；未命中返回 null */
  readPage(md5: string, time: number): Promise<ArrayBuffer | null>
  /** 写入某分页的解压后二进制（复制一份，避免与 transfer 到 worker 的同一 buffer 共享） */
  writePage(md5: string, time: number, buffer: ArrayBuffer): Promise<void>
  /** 删除不再被清单引用的历史分页缓存 */
  purgeStalePages(validKeys: Set<string>): Promise<void>
}

const manifestKey = (namespace: string) => `${namespace}:manifest`
const pageKey = (namespace: string, md5: string, time: number) => `${namespace}:page:${md5}:${time}`

export const buildMarkerCache = (
  kv: Table<Database.CacheEntry, string>,
  namespace = MARKER_NAMESPACE,
): MarkerCache => {
  return {
    namespace,

    async readManifest() {
      try {
        const entry = await kv.get(manifestKey(namespace))
        if (!entry) return null
        const value = entry.value as unknown as MarkerManifestCache
        if (!value?.list || !Array.isArray(value.list)) return null
        return value
      } catch {
        return null
      }
    },

    async writeManifest(list) {
      try {
        const value: MarkerManifestCache = { list, fetchedAt: Date.now() }
        await kv.put({ key: manifestKey(namespace), value, namespace }, manifestKey(namespace))
      } catch {
        // 忽略，降级为内存每次全量加载
      }
    },

    async readPage(md5, time) {
      try {
        const entry = await kv.get(pageKey(namespace, md5, time))
        if (!entry) return null
        const buffer = entry.value
        if (!(buffer instanceof ArrayBuffer)) return null
        return buffer
      } catch {
        return null
      }
    },

    async writePage(md5, time, buffer) {
      try {
        const value = buffer.slice(0)
        const key = pageKey(namespace, md5, time)
        await kv.put({ key, value, namespace }, key)
      } catch {
        // 忽略写入失败
      }
    },

    async purgeStalePages(validKeys) {
      try {
        const prefix = `${namespace}:page:`
        const stale: string[] = []
        await kv
          .where('key')
          .startsWith(prefix)
          .each((entry) => {
            if (!validKeys.has(entry.key)) stale.push(entry.key)
          })
        if (stale.length > 0) {
          await kv.bulkDelete(stale)
        }
      } catch {
        // 忽略清理失败，仅留下历史缓存，不影响功能
      }
    },
  }
}

/** 生产使用的单例缓存实例 */
export const markerCache = buildMarkerCache(db.kv)
