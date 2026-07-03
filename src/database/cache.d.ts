declare namespace Database {
  /** KV 缓存条目 */
  interface CacheEntry {
    key: string
    namespace: string
    value: unknown
  }
}
