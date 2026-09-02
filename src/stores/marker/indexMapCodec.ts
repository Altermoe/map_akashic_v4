/**
 * 反查索引 `Map<number, Set<number>>` 与扁平化 Int32Array 编码之间的转换。
 *
 * 倒排索引（Map 的 value 是变长 Set）无法直接用「可转移的 ArrayBuffer」零拷贝
 * 地在 worker 与主线程间传递，结构化克隆会复制整棵嵌套结构。这里将其编码为
 * 两个 Int32Array：
 *   - keys   按 Map 插入顺序，每个条目占两项：[key, count]，count 即该 key 对应 Set 的大小；
 *   - values 按 keys 的条目顺序，将各 Set 的元素依次扁平拼接。
 * 借助 count 即可在解码时把 values 逐一还原成 Set。
 */
export type MarkerIndex = Map<number, Set<number>>

export interface EncodedMarkerIndex {
  /** 扁平 key 顺序表：[key0, count0, key1, count1, ...] */
  keys: Int32Array
  /** 扁平 value 顺序表：按 key 顺序依次拼接各 Set 的元素 */
  values: Int32Array
}

export const encodeIndex = (index: MarkerIndex): EncodedMarkerIndex => {
  const entries = [...index]
  const keys = new Int32Array(entries.length * 2)
  let totalValues = 0
  for (let i = 0; i < entries.length; i++) {
    keys[i * 2] = entries[i][0]
    keys[i * 2 + 1] = entries[i][1].size
    totalValues += entries[i][1].size
  }
  const values = new Int32Array(totalValues)
  let offset = 0
  for (const [, set] of entries) {
    for (const v of set) values[offset++] = v
  }
  return { keys, values }
}

export const decodeIndex = ({ keys, values }: EncodedMarkerIndex): MarkerIndex => {
  const index = new Map<number, Set<number>>()
  let offset = 0
  for (let i = 0; i < keys.length; i += 2) {
    const key = keys[i]
    const count = keys[i + 1]
    const set = new Set<number>()
    for (let j = 0; j < count; j++) set.add(values[offset++])
    index.set(key, set)
  }
  return index
}
