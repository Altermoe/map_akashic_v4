import { CompositeLayer, IconLayer, ScatterplotLayer } from 'deck.gl'
import type { Layer, LayersList, CompositeLayerProps, IconLayerProps } from 'deck.gl'
import type { MarkerThin } from '@/stores/marker'

export type IconMapping = Exclude<NonNullable<IconLayerProps['iconMapping']>, string>

export interface GenshinMarkerLayerProps extends Partial<CompositeLayerProps> {
  data: MarkerThin[]
  iconAtlas?: string
  iconMapping: IconMapping
  positionOffset?: [x: number, y: number]
}

export interface MixtureIconLayerProps extends IconLayerProps<MarkerThin> {
  bottomMask: number
  topMask: number
  /** 0 ~ 2 (0% ~ 200%) */
  iconScale?: number
  iconTranslate?: [number, number]
}

class MixtureIconLayer extends IconLayer<MarkerThin, {}> {
  static layerName = 'MixtureIconLayer'

  constructor(props: MixtureIconLayerProps) {
    super(props)
  }
}

const DEFAULT_POSITION = [0, 0] as [number, number]

export class GenshinMarkerLayer extends CompositeLayer<GenshinMarkerLayerProps> {
  static layerName = 'GenshinMarkerLayer'

  constructor(props: GenshinMarkerLayerProps) {
    super(props)
  }

  #createPlaceholderLayer(param: { data: MarkerThin[]; offset: [number, number] }) {
    const [ox = 0, oy = 0] = param.offset
    return new ScatterplotLayer<MarkerThin>({
      id: 'GenshinMarkerLayer-Scatterplot',
      data: param.data,
      stroked: true,
      getPosition: ({ pos }) => [pos[0] + ox, pos[1] + oy],
      getFillColor: [255, 200, 0, 255],
      getLineColor: [0, 0, 0, 255],
      getLineWidth: 1,
      lineWidthMaxPixels: 1,
      getRadius: 16,
      radiusMinPixels: 4,
      radiusMaxPixels: 16,
      pickable: true,
      updateTriggers: {
        getPosition: param.offset,
      },
    })
  }

  #createMarkerLayer(param: {
    data: MarkerThin[]
    iconAtlas: string
    iconMapping: IconMapping
    offset: [number, number]
  }) {
    const [ox = 0, oy = 0] = param.offset
    return new MixtureIconLayer({
      pickable: true,
      bottomMask: 0b01,
      topMask: 0b0,
      id: 'GenshinMarkerLayer-MixtureIcon',
      data: param.data,
      iconAtlas: param.iconAtlas,
      iconMapping: param.iconMapping,
      getPosition: ({ pos }) => [pos[0] + ox, pos[1] + oy],
      getIcon: ({ icon }) => icon,
      getSize: 64,
      sizeScale: 0.5,
      sizeMinPixels: 4,
      updateTriggers: {
        getPosition: param.offset,
      },
    })
  }

  override renderLayers(): Layer | null | LayersList {
    const { data, iconAtlas, iconMapping, positionOffset = DEFAULT_POSITION } = this.props
    return [
      !iconAtlas
        ? this.#createPlaceholderLayer({
            data,
            offset: positionOffset,
          })
        : null,
      iconAtlas
        ? this.#createMarkerLayer({
            data,
            iconAtlas,
            iconMapping,
            offset: positionOffset,
          })
        : null,
    ]
  }
}
