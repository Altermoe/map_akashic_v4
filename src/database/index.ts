import { Dexie } from 'dexie'

class AppDatabase extends Dexie {
  declare settings: Dexie.Table<Database.Settings, number>
  declare service: Dexie.Table<Database.CacheEntry, string>

  constructor() {
    super('app-database')
    this.version(1).stores({
      service: '&key, namespace',
      settings: '++id, [userId+settingKey], userId, settingKey',
    })
  }
}

export const db = new AppDatabase()
