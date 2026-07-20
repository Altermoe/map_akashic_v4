import { CompositeLayer, TileLayer, BitmapLayer, LayerContext } from 'deck.gl'
import Api from '@/api'
import type { GenshinDeck } from '../../core/genshin-deck'
import type { ResolvedTileset } from '../../types'
import { GenshinLayer } from '../../types'
import { onReady } from '../../utils'
import { easeOutQuart } from '../../utils/transition-easing'

/** 符合 Genshin Tileset 格式的资源地址 */
const BASE_URL = import.meta.env.VITE_SERVICE_RESOURCE_URL
/** 缩放偏移量 */
const ZOOM_MAPPING = 13

export interface GenshinTileLayerProps {
  data: ResolvedTileset
  visible: boolean
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

  constructor(data: ResolvedTileset, visible = true) {
    const { xmax, xmin, ymax, ymin } = getExtent(data)
    super({
      id: 'GenshinTileLayer',
      data,
      visible,
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

  override renderLayers() {
    return createTileLayer(this.props.data, this.props.visible)
  }

  finalizeState(context: LayerContext): void {
    super.finalizeState(context)
    if (this.#rIC) {
      cancelIdleCallback(this.#rIC)
    }
  }

  async applyDeck(deck: GenshinDeck) {
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
        maxBounds: this.props.bounds,
        scrollZoom: false,
      },
      initialViewState: {
        ...this.props.initViewState,
        maxZoom: 2,
        minZoom: -4,
        transitionEasing: easeOutQuart,
        transitionDuration: 500,
      },
    })
  }
}
