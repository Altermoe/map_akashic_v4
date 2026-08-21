/**
 * atlas 合批的纯布局数学（尺寸 / 排布 / 单元定位）。
 *
 * 从 render.worker 中抽出的纯函数集：不依赖 WebGPU / deck.gl / DOM，
 * 可在 node 测试环境直接回归（如 `ICON_STATE`↔首行状态列序一致性、整体尺寸平方根布局）。
 * 渲染 worker 只负责 transport 与 WebGPU 绘制，布局决策收敛在本模块。
 */

export const DEFAULT_ICON_SIZE = 64
export const DEFAULT_ICON_GAP = 1

export interface AtlasLayoutInput {
  gap: number
  size: number
  maxTextureSize: number
  iconCount: number
  stateCount: number
}

export interface Layout {
  cols: number
  rows: number
}

/** 精灵单元占位 = size + gap，避免舍入精度导致的重叠 */
export const iconPitch = (size: number, gap: number): number => size + gap

/**
 * 计算 atlas 网格列/行数。
 * - 主图标：预留 1 行状态后，使整体纹理尽可能接近正方形（cols ≈ iconRows + 1，cols*(cols-1) >= iconCount）；
 * - 状态行：fallback + 各状态需在同一行容纳（stateCols = 1 + stateCount）；
 * - 行列数取二者最大值，且不超过纹理尺寸限制。
 */
export const calculateLayout = ({
  gap,
  size,
  maxTextureSize,
  iconCount,
  stateCount,
}: AtlasLayoutInput): Layout => {
  const pitch = iconPitch(size, gap)
  const maxCols = Math.max(1, Math.floor(maxTextureSize / pitch))

  // 从 icon 总数计算的列数：预留 1 行状态后，使整体纹理尽可能接近正方形
  // 目标 cols ≈ iconRows + 1 且 cols * (cols - 1) >= iconCount
  const iconCols = iconCount > 0 ? Math.ceil((1 + Math.sqrt(1 + 4 * iconCount)) / 2) : 1
  // 从状态纹理数计算的列数：fallback + 各状态需在同一行容纳
  const stateCols = 1 + stateCount

  // 取二者最大值，且不超过纹理尺寸限制
  const cols = Math.min(Math.max(iconCols, stateCols), maxCols)

  // 行数：预留 1 行状态行 + icon 所需行数
  const iconRows = Math.ceil(iconCount / cols)
  const rows = iconRows + 1

  return { cols, rows }
}

export interface AtlasCell {
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
}

/** fallback（unknown）单元格：atlas 第 0 行第 0 列 */
export const fallbackCell = (size: number): AtlasCell => ({
  x: 0,
  y: 0,
  width: size,
  height: size,
  anchorX: size / 2,
  anchorY: size / 2,
})

/** 主图标第 i 个所在的单元格：图标从第 1 行开始铺开（第 0 行预留 fallback + 状态） */
export const mainIconCell = (index: number, cols: number, size: number, gap: number): AtlasCell => {
  const pitch = iconPitch(size, gap)
  const col = index % cols
  const row = 1 + Math.floor(index / cols)
  const x = col * pitch
  const y = row * pitch
  return { x, y, width: size, height: size, anchorX: size / 2, anchorY: size / 2 }
}

/** 状态行（第 0 行）第 i 个状态单元格的 x 起点；首列 unknown 已占 x=0 */
export const stateCellX = (index: number, size: number, gap: number): number =>
  (index + 1) * iconPitch(size, gap)

/** atlas 贴图实际尺寸（last cell 的 pitch 起点 + size，再减 gap） */
export const atlasDimensions = (
  cols: number,
  rows: number,
  size: number,
  gap: number,
): { width: number; height: number } => {
  const pitch = iconPitch(size, gap)
  return {
    width: Math.max(1, cols * pitch - gap),
    height: Math.max(1, rows * pitch - gap),
  }
}