import { describe, expect, it } from 'vitest'
import {
  atlasDimensions,
  calculateLayout,
  fallbackCell,
  iconPitch,
  mainIconCell,
  stateCellX,
  type Layout,
} from './atlas-layout'

const BASE = { size: 64, gap: 1, maxTextureSize: 4096 }

/**
 * atlas 布局纯数学的回归。重点覆盖两处易碎的不变量：
 * 1. 第 0 行预留（fallback + 状态），主图标从第 1 行铺开（mainIconCell.y >= pitch）；
 * 2. 状态行列序 stateCellX(i) = (i+1)*pitch —— 与 shader `(i+1)*(iconSize+gap)` 采样列一一对应（陷阱 3）。
 */
describe('atlas-layout', () => {
  describe('calculateLayout', () => {
    it('主图标铺成尽量接近正方形，并预留 1 行状态行', () => {
      const layout = calculateLayout({ ...BASE, iconCount: 10, stateCount: 2 })
      expect(layout).toEqual<Layout>({ cols: 4, rows: 4 })
    })

    it('状态行数量决定最小列数（fallback + stateCount 需同一行容纳）', () => {
      const layout = calculateLayout({ ...BASE, iconCount: 1, stateCount: 5 })
      expect(layout.cols).toBe(6) // 1 fallback + 5 state
      expect(layout.rows).toBe(2)
    })

    it('列数受 maxTextureSize 钳制', () => {
      const layout = calculateLayout({
        size: 64,
        gap: 1,
        maxTextureSize: 130, // floor(130/65)=2
        iconCount: 100,
        stateCount: 2,
      })
      expect(layout.cols).toBe(2)
      expect(layout.rows).toBe(51) // ceil(100/2)+1
    })

    it('无图标时仍回退到 1x1 状态行', () => {
      expect(calculateLayout({ ...BASE, iconCount: 0, stateCount: 0 })).toEqual({ cols: 1, rows: 1 })
    })
  })

  describe('cell 定位（第 0 行预留不变量）', () => {
    const pitch = iconPitch(64, 1)

    it('fallback 固定在第 0 行第 0 列', () => {
      expect(fallbackCell(64)).toEqual({
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        anchorX: 32,
        anchorY: 32,
      })
    })

    it('主图标从第 1 行铺开，x 按列 * pitch，不侵占状态行', () => {
      const cols = 4
      expect(mainIconCell(0, cols, 64, 1).y).toBe(pitch) // row 1
      expect(mainIconCell(3, cols, 64, 1)).toMatchObject({ x: 3 * pitch, y: pitch })
      expect(mainIconCell(4, cols, 64, 1).y).toBe(2 * pitch) // row 2
    })

    it('状态行列序 stateCellX(i) = (i+1)*pitch，与 shader 首行采样列一致', () => {
      expect(stateCellX(0, 64, 1)).toBe(pitch)
      expect(stateCellX(1, 64, 1)).toBe(2 * pitch)
      expect(stateCellX(4, 64, 1)).toBe(5 * pitch)
    })
  })

  describe('atlasDimensions', () => {
    it('尺寸 = cols*pitch - gap，最小为 1', () => {
      expect(atlasDimensions(4, 4, 64, 1)).toEqual({ width: 259, height: 259 })
      expect(atlasDimensions(1, 1, 64, 1)).toEqual({ width: 64, height: 64 })
      expect(atlasDimensions(1, 1, 1, 1)).toEqual({ width: 1, height: 1 })
    })
  })
})