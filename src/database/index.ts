import { Dexie } from 'dexie'

class AppDatabase extends Dexie {
  /** 用户本地设置 */
  declare settings: Dexie.Table<Database.Settings, number>
  /** 通用 KV 缓存 */
  declare kv: Dexie.Table<Database.CacheEntry, string>

  constructor() {
    super('app-database')
    this.version(1).stores({
      kv: '&key, namespace',
      settings: '++id, [userId+settingKey], userId, settingKey',
    })
  }
}

export const db = new AppDatabase()
