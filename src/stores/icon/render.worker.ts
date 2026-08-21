import type { IconLayerProps } from '@deck.gl/layers'
import { getCacheableAsset } from '@/api/services/assets/apiDefinitions'
import unknownIconUrl from '@/assets/unknown.png?url'
import { createAsyncConcurrencyFactory } from '@/utils/common'
import { handleRequest } from '@/utils/worker'
import {
  atlasDimensions,
  calculateLayout,
  DEFAULT_ICON_GAP,
  DEFAULT_ICON_SIZE,
  fallbackCell,
  mainIconCell,
  stateCellX,
} from './atlas-layout'
import shaderCode from './render.wgsl?raw'

const CONCURRENCY_LIMIT = 100
const DEFAULT_BACKGROUND: Color = [0, 0, 0, 0]

export type IconMapping = Exclude<Required<IconLayerProps>['iconMapping'], string>
type Color = [R: number, G: number, B: number, A: number]

interface RenderOptions {
  /** 精灵单元尺寸（宽度=高度） @default 64 */
  size: number
  /** 渲染间距 - 避免舍入精度导致的重叠 @default 1 */
  gap: number
  /** 纹理背景色 @default [0,0,0,0] */
  background: [R: number, G: number, B: number, A: number]
}

export interface RenderResult {
  texture: Blob
  mapping: IconMapping
}

export interface RenderRequest {
  /** 图标列表 */
  data: { id: number; url: string }[]
  /** 状态列表 - 按顺序渲染 */
  state?: {
    key: string
    url: string
  }[]
  /** 渲染参数 */
  render?: Partial<RenderOptions>
}

// ============================== scoped state ==============================
/** 请求去重 */
const inflightRequests = new Map<string, Promise<ImageBitmap>>()

/** fallback 缓存 */
let fallbackBmp: ImageBitmap | null = null

/** GPUDevice 单例（跨请求复用） */
let devicePromise: Promise<GPUDevice> | null = null

// ==============================   functions   ==============================
const ensureFallback = async () => {
  if (fallbackBmp) return fallbackBmp
  const cache = inflightRequests.get(unknownIconUrl)
  if (cache) {
    const bmp = await cache
    return bmp
  }
  const promise = getCacheableAsset(unknownIconUrl).then((blob) => createImageBitmap(blob))
  inflightRequests.set(unknownIconUrl, promise)
  const bmp = await promise
  return bmp
}

const ensureDevice = async () => {
  if (devicePromise) return devicePromise
  if (!navigator.gpu) throw new Error('不支持 WebGPU')
  devicePromise = (async () => {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) throw new Error('无法获取 GPU 适配器')
    const device = await adapter.requestDevice()
    // 设备丢失时重置单例，允许下次重新创建
    device.lost.then(() => {
      if (devicePromise) devicePromise = null
    })
    return device
  })()
  try {
    return await devicePromise
  } catch (err) {
    devicePromise = null
    throw err
  }
}

// ==============================     core     ==============================
handleRequest<RenderRequest, RenderResult>(
  async ({ data: { data, state, render }, send, progress, signal }) => {
    progress(0, '初始化渲染环境')

    // 校验 fallback 资源
    const fallbackImageBitmap = await ensureFallback()

    // 初始化 WebGPU 设备
    const device = await ensureDevice()

    // 检测 WebGPU 参数
    const maxTextureSize = device.limits.maxTextureDimension2D

    // 初始化 mapping
    const {
      size = DEFAULT_ICON_SIZE,
      gap = DEFAULT_ICON_GAP,
      background = DEFAULT_BACKGROUND,
    } = render ?? {}
    const mapping: IconMapping = Object.create(null)

    // 计算布局参数
    const layout = calculateLayout({
      maxTextureSize,
      size,
      gap,
      iconCount: data.length,
      stateCount: state?.length ?? 0,
    })

    // 设置 fallback 用的 unknown 图片
    const fallbackMapping = fallbackCell(size)
    mapping[-1] = fallbackMapping

    // 请求图片并计算和 set mapping
    const getIcon = createAsyncConcurrencyFactory(async (url: string) => {
      // 校验 url：忽略查询参数后，末尾必须包含文件后缀名，否则视为非法 url
      const pathname = url.split('?')[0]!.split('#')[0]!
      const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1)
      if (!/\.[^./]+$/.test(lastSegment)) throw new Error(`非法的图标 url，缺少文件后缀名：${url}`)

      const existing = inflightRequests.get(url)
      if (existing) {
        const bmp = await existing
        return bmp
      }
      const promise = getCacheableAsset(url, { signal, cacheError: true })
        .then((blob) => createImageBitmap(blob))
        .finally(() => inflightRequests.delete(url))
      inflightRequests.set(url, promise)
      const bmp = await promise
      return bmp
    }, CONCURRENCY_LIMIT)

    // 下载主图标
    const settled = await (async () => {
      const total = data.length
      if (total === 0) {
        progress(40, '无主图标需要下载')
        return [] as PromiseSettledResult<ImageBitmap>[]
      }
      progress(0, `准备下载 ${total} 个主图标`)
      let finished = 0
      const tasks = data.map(({ url }) =>
        getIcon(url).then(
          (value): PromiseSettledResult<ImageBitmap> => {
            finished += 1
            progress(Math.round((finished / total) * 40), `下载主图标中 ${finished}/${total}`)
            return { status: 'fulfilled', value }
          },
          (reason): PromiseSettledResult<ImageBitmap> => {
            finished += 1
            progress(Math.round((finished / total) * 40), `下载主图标中 ${finished}/${total}`)
            return { status: 'rejected', reason }
          },
        ),
      )
      return Promise.all(tasks)
    })()

    // 每个主图标使用的 bitmap（失败时降级为 fallback）
    const bitmaps: ImageBitmap[] = settled.map((r) =>
      r.status === 'fulfilled' ? r.value : fallbackImageBitmap,
    )

    // 下载 state 图标
    const stateSettled = await (async () => {
      if (!state || state.length === 0) {
        progress(80, '无状态图标需要下载')
        return [] as PromiseSettledResult<ImageBitmap>[]
      }
      progress(40, `准备下载 ${state.length} 个状态图标`)
      let finished = 0
      const tasks = state.map(({ url }) =>
        getIcon(url).then(
          (value): PromiseSettledResult<ImageBitmap> => {
            finished += 1
            progress(
              40 + Math.round((finished / state.length) * 40),
              `下载状态图标中 ${finished}/${state.length}`,
            )
            return { status: 'fulfilled', value }
          },
          (reason): PromiseSettledResult<ImageBitmap> => {
            finished += 1
            progress(
              40 + Math.round((finished / state.length) * 40),
              `下载状态图标中 ${finished}/${state.length}`,
            )
            return { status: 'rejected', reason }
          },
        ),
      )
      return Promise.all(tasks)
    })()

    // 每个 state 图标使用的 bitmap（失败时降级为 fallback）
    const stateBitmaps: ImageBitmap[] = stateSettled.map((r) =>
      r.status === 'fulfilled' ? r.value : fallbackImageBitmap,
    )

    // 构建 mapping：第 0 行预留（fallback + 状态），图标从第 1 行开始铺开
    for (let i = 0; i < data.length; i++) {
      const { id } = data[i]
      if (settled[i].status !== 'fulfilled') {
        // 请求失败：mapping 指向第一行的 fallback 区域
        mapping[id] = fallbackMapping
        continue
      }
      mapping[id] = mainIconCell(i, layout.cols, size, gap)
    }

    // ============================== WebGPU 精灵矩阵图渲染 ==============================
    progress(82, '初始化 GPU 画布与管线')
    const { width: atlasWidth, height: atlasHeight } = atlasDimensions(
      layout.cols,
      layout.rows,
      size,
      gap,
    )
    const canvas = new OffscreenCanvas(atlasWidth, atlasHeight)
    const context = canvas.getContext('webgpu')
    if (!context) {
      throw new Error('不支持 WebGPU 画布上下文')
    }

    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })

    // 创建渲染管线
    const shaderModule = device.createShaderModule({ code: shaderCode })
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 2 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
          },
          {
            arrayStride: 2 * 4,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x2' }],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format,
            blend: {
              // 与原 WebGL2 blendFuncSeparate(SRC_ALPHA, 1-SRC_ALPHA, ONE, 1-SRC_ALPHA) 保持一致
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    })

    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })

    // 固定的 UV（图像左上到右下），与 ImageBitmap 上下方向一致
    // (0,0) 左上 -> (1,0) 右上 -> (0,1) 左下 -> (0,1),(1,0),(1,1)
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    const uvBuffer = device.createBuffer({
      size: uvs.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(uvBuffer, 0, uvs)

    // 收集所有待绘制的图标（第一行的 fallback + state + 图标行的成功项）
    progress(86, '构建图标顶点数据')
    const iconsToDraw: { bmp: ImageBitmap; cellX: number; cellY: number }[] = []
    iconsToDraw.push({ bmp: fallbackImageBitmap, cellX: 0, cellY: 0 })
    // 添加 state 图标到首行，unknown 图标后
    for (let i = 0; i < (state?.length ?? 0); i++) {
      if (stateSettled[i].status !== 'fulfilled') continue
      iconsToDraw.push({ bmp: stateBitmaps[i], cellX: stateCellX(i, size, gap), cellY: 0 })
    }
    // 添加主图标
    for (let i = 0; i < data.length; i++) {
      if (settled[i].status !== 'fulfilled') continue
      const cell = mainIconCell(i, layout.cols, size, gap)
      iconsToDraw.push({ bmp: bitmaps[i], cellX: cell.x, cellY: cell.y })
    }

    // 预生成所有 quad 的 NDC 顶点数据（contain 模式）
    const positions = new Float32Array(iconsToDraw.length * 12)
    for (let i = 0; i < iconsToDraw.length; i++) {
      const { bmp, cellX, cellY } = iconsToDraw[i]
      // contain 适配：等比缩放至完全容纳于 size×size 单元格内
      const scale = Math.min(size / bmp.width, size / bmp.height)
      const w = bmp.width * scale
      const h = bmp.height * scale
      const px = cellX + (size - w) / 2
      const py = cellY + (size - h) / 2

      // 像素坐标（左上原点）→ 裁剪空间坐标（左下原点，Y 翻转）
      const x0 = (px / atlasWidth) * 2 - 1
      const x1 = ((px + w) / atlasWidth) * 2 - 1
      const y0 = 1 - (py / atlasHeight) * 2
      const y1 = 1 - ((py + h) / atlasHeight) * 2

      const off = i * 12
      positions[off + 0] = x0
      positions[off + 1] = y0
      positions[off + 2] = x1
      positions[off + 3] = y0
      positions[off + 4] = x0
      positions[off + 5] = y1
      positions[off + 6] = x0
      positions[off + 7] = y1
      positions[off + 8] = x1
      positions[off + 9] = y0
      positions[off + 10] = x1
      positions[off + 11] = y1
    }

    const posBuffer = device.createBuffer({
      size: Math.max(positions.byteLength, 12 * 4),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    if (positions.byteLength > 0) {
      device.queue.writeBuffer(posBuffer, 0, positions)
    }

    // 每个图标创建独立纹理与 bindGroup
    progress(90, '上传纹理数据')
    const iconTextures: GPUTexture[] = []
    const bindGroups: GPUBindGroup[] = []
    const bindGroupLayout = pipeline.getBindGroupLayout(0)
    for (const { bmp } of iconsToDraw) {
      const tex = device.createTexture({
        size: [bmp.width, bmp.height, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      })
      device.queue.copyExternalImageToTexture(
        { source: bmp },
        { texture: tex, premultipliedAlpha: false },
        [bmp.width, bmp.height],
      )
      iconTextures.push(tex)
      bindGroups.push(
        device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: tex.createView() },
          ],
        }),
      )
    }

    // 编码并提交
    progress(94, '提交 GPU 渲染指令')
    const encoder = device.createCommandEncoder()
    const [br, bgc, bb, ba] = background
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: br / 255, g: bgc / 255, b: bb / 255, a: ba / 255 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(1, uvBuffer)
    // 每个 icon 使用偏移访问共享 posBuffer 中的对应 quad，
    // 而 uvBuffer 仅含 1 个 quad 供所有 icon 复用，因此 firstVertex 恒为 0
    const quadStride = 12 * 4
    for (let i = 0; i < iconsToDraw.length; i++) {
      pass.setVertexBuffer(0, posBuffer, i * quadStride, quadStride)
      pass.setBindGroup(0, bindGroups[i])
      pass.draw(6, 1, 0, 0)
    }
    pass.end()
    device.queue.submit([encoder.finish()])

    // 等待 GPU 提交任务完成后再回读，避免读取到未完成的纹理
    progress(97, '等待 GPU 渲染完成')
    await device.queue.onSubmittedWorkDone()

    // 清理临时资源
    for (const t of iconTextures) t.destroy()
    posBuffer.destroy()
    uvBuffer.destroy()

    const texture = await canvas.convertToBlob({ type: 'image/png' })
    progress(100, '渲染完成')
    send({ texture, mapping })
  },
)
