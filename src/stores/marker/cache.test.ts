import 'fake-indexeddb/auto'
import { Dexie, type Table } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildMarkerCache } from './cache'

/**
 * cache.ts 单测：用 fake-indexeddb 构造一个独立的 kv 表，验证缓存层读写与清理逻辑。
 * buildMarkerCache 只依赖 kv 表（注入），与全局 db 实例解耦，便于纯 node 环境回归。
 */
const createDb = () => {
  const db = new Dexie('test-marker-cache')
  db.version(1).stores({ kv: '&key, namespace' })
  return db
}

let db: Dexie
let kv: Table<Database.CacheEntry, string>

beforeEach(async () => {
  db = createDb()
  await db.open()
  kv = db.table('kv')
})

const makeBuffer = (byte: number) => {
  const buf = new ArrayBuffer(1)
  new Uint8Array(buf)[0] = byte
  return buf
}

const u8 = (buf: ArrayBuffer) => new Uint8Array(buf)[0]

describe('marker cache', () => {
  it('manifest：写入后原样读回，畸形容器返回 null', async () => {
    const cache = buildMarkerCache(kv)
    expect(await cache.readManifest()).toBeNull()

    const list = [
      { md5: 'a', time: 1 },
      { md5: 'b', time: 2 },
    ]
    await cache.writeManifest(list)

    const read = await cache.readManifest()
    expect(read?.list).toEqual(list)
    expect(typeof read?.fetchedAt).toBe('number')
  })

  it('page：按 md5+time key 读写往返，二进制内容一致', async () => {
    const cache = buildMarkerCache(kv)
    expect(await cache.readPage('md5x', 10)).toBeNull()

    const buf = makeBuffer(42)
    await cache.writePage('md5x', 10, buf)
    const read = await cache.readPage('md5x', 10)
    expect(u8(read!)).toBe(42)
    // 同一 md5 不同 time 视为不同版本
    expect(await cache.readPage('md5x', 11)).toBeNull()
  })

  it('page：写入的是缓存副本，不污染调用方 buffer', async () => {
    const cache = buildMarkerCache(kv)
    const buf = makeBuffer(7)
    await cache.writePage('md5x', 10, buf)
    // 调用方后续变更原 buffer，不应影响已缓存内容
    new Uint8Array(buf)[0] = 99
    expect(u8((await cache.readPage('md5x', 10))!)).toBe(7)
  })

  it('purgeStalePages：只删除未被 validKeys 引用的历史分页', async () => {
    const cache = buildMarkerCache(kv)
    await cache.writePage('a', 1, makeBuffer(1))
    await cache.writePage('a', 2, makeBuffer(2)) // 同 md5 旧版本
    await cache.writePage('b', 1, makeBuffer(3))
    await cache.writeManifest([{ md5: 'b', time: 1 }])

    // 合法 key 只含 b:1；两者都带 namespace 前缀才与缓存 key 对齐
    await cache.purgeStalePages(new Set(['marker:page:b:1']))

    expect(await cache.readPage('b', 1)).not.toBeNull()
    expect(await cache.readPage('a', 1)).toBeNull()
    expect(await cache.readPage('a', 2)).toBeNull()
  })

  it('namespace 隔离：不同 namespace 的 key 互不可见', async () => {
    const cacheA = buildMarkerCache(kv, 'ns-a')
    const cacheB = buildMarkerCache(kv, 'ns-b')
    await cacheA.writePage('md5', 1, makeBuffer(5))
    expect(await cacheB.readPage('md5', 1)).toBeNull()
  })
})
