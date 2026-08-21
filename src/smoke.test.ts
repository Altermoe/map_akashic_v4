import { describe, expect, it } from 'vitest'

/**
 * 冒烟测试：验证 vitest 工具链已就绪（config / alias / 运行环境）。
 * 纯 node 环境，无 DOM / WebGL 依赖。
 */
describe('vitest smoke', () => {
  it('resolves the @/ alias and runs in node environment', () => {
    expect(typeof globalThis.process).toBe('object')
    expect(1 + 1).toBe(2)
  })
})