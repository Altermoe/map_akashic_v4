import {
  CompositeLayer,
  TileLayer,
  BitmapLayer,
  LineLayer,
  PolygonLayer,
  TextLayer,
  type LayerContext,
} from 'deck.gl'
import type { CompositeLayerProps, Layer, UpdateParameters } from 'deck.gl'
import Api from '@/api'
import type { GenshinDeck } from '../../core/genshin-deck'
import type { ResolvedTileset } from '../../types'
import type { GenshinLayer } from '../../types'
import { onReady } from '../../utils'
import { easeOutQuart } from '../../utils/transition-easing'

/** 符合 Genshin Tileset 格式的资源地址 */
const BASE_URL = import.meta.env.VITE_SERVICE_RESOURCE_URL
/** 缩放偏移量 */
const ZOOM_MAPPING = 13
/** TileLayer 的最小/最大 tile z（与 createTileLayer 的 minZoom/maxZoom 对齐） */
const TILE_MIN_ZOOM = -3
const TILE_MAX_ZOOM = 0
/** TileLayer 的 tileSize（common space 单位） */
const TILE_PIXEL_SIZE = 256

export interface TileLayerDebugOptions {
  /** 是否显示 tile */
  showTile?: boolean
  /** 是否显示 tile 索引信息 */
  showTileIndex?: boolean
  /** 是否显示 tile 布局网格 */
  showLayout?: boolean
  /** 是否显示 tile-layer 边界 */
  showBounds?: boolean
}

export interface GenshinTileLayerProps {
  data: ResolvedTileset
  visible: boolean
  debug?: TileLayerDebugOptions
  bounds: [min: [number, number], max: [number, number]]
  initViewState: {
    target: [number, number]
    zoom: number
  }
}

interface TileData {
  byteLength: number
  url: string
  image: ImageBitmap
}

interface TileExtent {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}

type TileIndex = Parameters<TileLayer['getTileData']>[0]['index']

/** 计算 tile 图层边界 */
const getExtent = (data: ResolvedTileset): TileExtent => {
  const {
    size: { 0: w, 1: h },
    tilesOffset: { 0: ox, 1: oy },
  } = data
  return {
    xmin: ox,
    xmax: w + ox,
    ymin: oy,
    ymax: h + oy,
  }
}

/** 与 deck.gl TileLayer 一致的 effective z（clamp 到 min/maxZoom） */
const getEffectiveTileZoom = (viewportZoom: number): number => {
  let z = Math.ceil(viewportZoom)
  if (z < TILE_MIN_ZOOM) z = TILE_MIN_ZOOM
  if (z > TILE_MAX_ZOOM) z = TILE_MAX_ZOOM
  return z
}

/** tile 在 common space 的边长 = tileSize * 2^(-z) */
const getTileSpacing = (z: number): number => TILE_PIXEL_SIZE * Math.pow(2, -z)

interface GridLayoutLine {
  sourcePosition: [number, number]
  targetPosition: [number, number]
}

/** 生成布局网格线段（覆盖 extent，对齐 tile 边界） */
const buildGridLayout = (extent: TileExtent, z: number): GridLayoutLine[] => {
  const spacing = getTileSpacing(z)
  const minTx = Math.floor(extent.xmin / spacing)
  const maxTx = Math.ceil(extent.xmax / spacing)
  const minTy = Math.floor(extent.ymin / spacing)
  const maxTy = Math.ceil(extent.ymax / spacing)
  const xStart = minTx * spacing
  const xEnd = maxTx * spacing
  const yStart = minTy * spacing
  const yEnd = maxTy * spacing
  const lines: GridLayoutLine[] = []
  for (let tx = minTx; tx <= maxTx; tx++) {
    const x = tx * spacing
    lines.push({ sourcePosition: [x, yStart], targetPosition: [x, yEnd] })
  }
  for (let ty = minTy; ty <= maxTy; ty++) {
    const y = ty * spacing
    lines.push({ sourcePosition: [xStart, y], targetPosition: [xEnd, y] })
  }
  return lines
}

interface TileLabel {
  position: [number, number]
  text: string
}

/** 生成每个 tile 的索引标签（位于 tile 中心） */
const buildTileLabels = (extent: TileExtent, z: number): TileLabel[] => {
  const spacing = getTileSpacing(z)
  const minTx = Math.floor(extent.xmin / spacing)
  const maxTx = Math.ceil(extent.xmax / spacing) - 1
  const minTy = Math.floor(extent.ymin / spacing)
  const maxTy = Math.ceil(extent.ymax / spacing) - 1
  const labels: TileLabel[] = []
  for (let tx = minTx; tx <= maxTx; tx++) {
    for (let ty = minTy; ty <= maxTy; ty++) {
      labels.push({
        position: [(tx + 0.5) * spacing, (ty + 0.5) * spacing],
        text: `${tx},${ty},${z}`,
      })
    }
  }
  return labels
}

const getInitTarget = (data: ResolvedTileset): [number, number] => {
  if (!data.settings?.center) {
    return [0, 0]
  }
  const [x, y] = data.settings.center
  const [ox, oy] = data.center
  return [x + ox, y + oy]
}

/** 计算 tile 块的 url */
const getTileUrl = (data: ResolvedTileset, index: TileIndex): string => {
  const { x, y, z } = index
  const url = `${BASE_URL}/tiles_${data.pathId}/${z + ZOOM_MAPPING}/${x}_${y}.png`
  return url
}

const createTileLayer = (tileset: ResolvedTileset, visible: boolean) => {
  const { xmax, xmin, ymax, ymin } = getExtent(tileset)

  const tileLayer = new TileLayer<TileData | null>({
    id: `TileLayer(${tileset.pathId})`,
    data: null,
    visible,
    minZoom: -3,
    maxZoom: 0,
    tileSize: 256,
    extent: [xmin, ymin, xmax, ymax],
    refinementStrategy: 'best-available',
    maxCacheByteSize: Number.MAX_SAFE_INTEGER,
    maxCacheSize: 512 * 2 ** 20, // 512 MiB
    maxRequests: 64,
    getTileData: async ({ index, signal }) => {
      if (signal?.aborted) {
        return null
      }
      try {
        const url = getTileUrl(tileset, index)
        const bmp = await Api.assets.getTile(
          {
            pathId: tileset.pathId,
            x: index.x,
            y: index.y,
            z: index.z,
            zMapping: ZOOM_MAPPING,
            extension: tileset.extension,
          },
          signal,
        )
        return {
          byteLength: bmp.width * bmp.height * 4,
          image: bmp,
          url,
        } as TileData
      } catch (err) {
        // 重新抛出 abort 错误，让 deck.gl 通过 _isCancelled 机制正确处理
        if (signal?.aborted) {
          throw err
        }
        return null
      }
    },
    renderSubLayers: ({ data, tile }) => {
      if (!data || typeof data === 'string') {
        return null
      }
      const {
        0: { 0: xmin, 1: ymin },
        1: { 0: xmax, 1: ymax },
      } = tile.boundingBox
      return new BitmapLayer({
        id: `BitmapLayer(${data.url})`,
        image: data.image,
        bounds: [xmin, ymax, xmax, ymin],
      })
    },
  })

  return tileLayer
}

export class GenshinTileLayer
  extends CompositeLayer<GenshinTileLayerProps>
  implements GenshinLayer
{
  static layerName = 'GenshinTileLayer'

  constructor(data: ResolvedTileset, visible = true, debug?: TileLayerDebugOptions) {
    const { xmax, xmin, ymax, ymin } = getExtent(data)
    super({
      id: 'GenshinTileLayer',
      data,
      visible,
      debug,
      bounds: [
        [xmin, ymin],
        [xmax, ymax],
      ],
      initViewState: {
        target: getInitTarget(data),
        zoom: data.settings?.zoom ?? -1,
      },
    })
  }

  #rIC: number | null = null

  shouldUpdateState(
    params: UpdateParameters<Layer<GenshinTileLayerProps & Required<CompositeLayerProps>>>,
  ): boolean {
    return this.props.debug
      ? params.changeFlags.somethingChanged
      : params.changeFlags.propsOrDataChanged
  }

  override renderLayers() {
    const { data, visible, debug } = this.props
    const extent = getExtent(data)
    const layers: Layer[] = !debug || debug.showTile ? [createTileLayer(data, visible)] : []

    if (debug) {
      const z = getEffectiveTileZoom(this.context.viewport.zoom)

      if (debug.showLayout) {
        layers.push(
          new LineLayer<GridLayoutLine>({
            id: 'debug-tile-layout',
            visible,
            data: buildGridLayout(extent, z),
            getSourcePosition: (d) => d.sourcePosition,
            getTargetPosition: (d) => d.targetPosition,
            getColor: [0, 255, 255],
            widthUnits: 'pixels',
            widthScale: 1,
            widthMinPixels: 1,
          }),
        )
      }

      if (debug.showBounds) {
        const ring: [number, number][] = [
          [extent.xmin, extent.ymin],
          [extent.xmax, extent.ymin],
          [extent.xmax, extent.ymax],
          [extent.xmin, extent.ymax],
        ]
        layers.push(
          new PolygonLayer<[number, number][]>({
            id: 'debug-tile-bounds',
            visible,
            data: [ring],
            getPolygon: (d) => d,
            stroked: true,
            filled: false,
            getLineColor: [255, 0, 255],
            getLineWidth: 1,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: 1,
          }),
        )
      }

      if (debug.showTileIndex) {
        layers.push(
          new TextLayer<TileLabel>({
            id: 'debug-tile-info',
            visible,
            data: buildTileLabels(extent, z),
            getPosition: (d) => d.position,
            getText: (d) => d.text,
            getColor: [255, 255, 255],
            getSize: 12,
            sizeUnits: 'pixels',
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
          }),
        )
      }
    }

    return layers
  }

  finalizeState(context: LayerContext): void {
    super.finalizeState(context)
    if (this.#rIC) {
      cancelIdleCallback(this.#rIC)
    }
  }

  async applyDeck(deck: GenshinDeck) {
    const { bounds, initViewState, debug } = this.props
    await onReady(deck, {
      onSchedulerUpdate: (rIC) => {
        this.#rIC = rIC
      },
    })
    deck.setProps({
      controller: {
        dragMode: 'pan',
        dragRotate: false,
        inertia: 500,
        touchRotate: false,
        maxBounds: debug ? undefined : bounds,
        scrollZoom: false,
      },
    })
    const fromViewState = deck.getLiveViewState()
    if (!fromViewState?.target) {
      console.log('init viewState')
      deck.setProps({
        initialViewState: {
          target: initViewState.target,
          zoom: 0,
        },
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    deck.setProps({
      initialViewState: {
        ...initViewState,
        maxZoom: 2,
        minZoom: -4,
        transitionEasing: easeOutQuart,
        transitionDuration: 500,
      },
    })
  }
}
