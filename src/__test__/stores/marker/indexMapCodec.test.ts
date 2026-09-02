import { describe, expect, it } from 'vitest'
import { encodeIndex, decodeIndex } from '@/stores/marker/indexMapCodec'

describe('indexMapCodec', () => {
  it('编码为两个 Int32Array，还原后与原始 Map 一致', () => {
    const original = new Map<number, Set<number>>([
      [2001, new Set([1001, 1002])],
      [2002, new Set([1002])],
      [2005, new Set()],
    ])

    const { keys, values } = encodeIndex(original)
    expect(keys).toBeInstanceOf(Int32Array)
    expect(values).toBeInstanceOf(Int32Array)

    expect(decodeIndex({ keys, values })).toEqual(original)
  })

  it('空 Map 往返为空', () => {
    const encoded = encodeIndex(new Map())
    expect(decodeIndex(encoded)).toEqual(new Map())
  })
})
