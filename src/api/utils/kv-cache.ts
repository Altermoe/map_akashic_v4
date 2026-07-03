import type { AlovaGlobalCacheAdapter } from 'alova'
import { db } from '@/database'

/**
 * 创建 idb 本地缓存表的工厂函数
 */
export const createKvCache = (namespace: string): AlovaGlobalCacheAdapter => {
  const toDatabaseKey = (storageKey: string) => {
    return `${namespace}:${storageKey}`
  }

  return {
    get: async <T>(storageKey: string) => {
      const entry = await db.service.get(toDatabaseKey(storageKey))
      if (!entry) {
        return
      }
      return entry.value as T
    },
    set: async (storageKey, value) => {
      const key = toDatabaseKey(storageKey)
      await db.service.put({ key, value, namespace }, key)
    },
    remove: async (storageKey) => {
      const key = toDatabaseKey(storageKey)
      await db.service.delete(key)
    },
    clear: async () => {
      await db.service.where('namespace').equals(namespace).delete()
    },
  }
}
