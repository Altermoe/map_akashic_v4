import { CompositeLayer, IconLayer, ScatterplotLayer } from 'deck.gl'
import type { Layer, LayersList, CompositeLayerProps, IconLayerProps } from 'deck.gl'
import type { MarkerThin } from '@/stores/marker'
import mixtureFs from './mixture-icon-layer.fs.glsl?raw'
import { mixtureUniforms } from './mixture-icon-layer.uniforms'

export type IconMapping = Exclude<NonNullable<IconLayerProps['iconMapping']>, string>

export interface GenshinMarkerLayerProps extends Partial<CompositeLayerProps> {
  data: MarkerThin[]
  iconAtlas?: string
  iconMapping: IconMapping
  positionOffset?: [x: number, y: number]
}

export interface MixtureIconLayerProps extends IconLayerProps<MarkerThin> {
  /** 状态纹理位掩码(位于最底层),bit i 对应首行第 (i+1) 列的状态纹理 */
  bottomMask?: number
  /** 状态纹理位掩码(位于最顶层),bit i 对应首行第 (i+1) 列的状态纹理 */
  topMask?: number
  /** 图标缩放倍率 (0~2,默认 1) — 以图标中心为原点 */
  iconScale?: number
  /** 图标平移偏移 (绝对像素,默认 [0, 0]) — 以图标中心为原点 */
  iconTranslate?: [number, number]
}

/**
 * 支持状态位掩码混合的 IconLayer
 *
 * 渲染管线:
 * 1. 原始图标 → 在 vertex shader 中按 iconScale 缩放、按 iconTranslate 平移
 * 2. 在 fragment shader 中按"bottomMask 状态 → 原始纹理 → topMask 状态"的层级混合
 *
 * 状态纹理位置: iconAtlas 首行第 1 列起为 state[0]、state[1]...(第 0 列为 unknown fallback)
 * 状态纹理在 atlas 中的 X 偏移 = (i + 1) * (iconSize.x + iconGap)
 */
class MixtureIconLayer extends IconLayer<MarkerThin, MixtureIconLayerProps> {
  static layerName = 'MixtureIconLayer'

  static defaultProps = {
    ...IconLayer.defaultProps,
    bottomMask: 0,
    topMask: 0,
    iconScale: 0.6,
    iconTranslate: [0, 0] as [number, number],
  }

  override getShaders() {
    const shaders = super.getShaders()
    return {
      ...shaders,
      fs: mixtureFs,
      modules: [...shaders.modules, mixtureUniforms],
      defines: {
        ...shaders.defines,
        // 状态纹理最大位数 = 8(bit 0~7)
        // 性能优先:使用编译时常量以展开循环,修改此处需同步修改 fragment shader 中数组大小
        MIXTURE_MAX_STATE_BITS: 8,
      },
      inject: {
        ...shaders.inject,
        'vs:#decl': /* glsl */ `
out vec2 vMixtureTextureCoords;
out vec2 vMixtureUV;
out vec2 vMixtureStateCoords[MIXTURE_MAX_STATE_BITS];
`,
        'vs:#main-end': /* glsl */ `
// === MixtureIconLayer: 计算缩放/平移后的原始纹理 UV 与各状态纹理 UV ===

// 1. 基础 quadUV ([0, 1] 区间,0 = 左上,1 = 右下)
vec2 quadUV = (positions.xy + 1.0) / 2.0;

// 2. 应用 iconScale: 以图标中心 (0.5, 0.5) 为原点缩放
//    iconScale < 1: 图标缩小,只显示中心区域
//    iconScale > 1: 图标放大,只看到中心 1/iconScale 范围
//    边界处理: max 防止 0 除
vec2 mixtureUV = (quadUV - 0.5) / max(mixture.mixtureIconScale, 0.0001) + 0.5;

// 3. 应用 iconTranslate: 以图标中心偏移 (绝对像素 → UV 空间)
//    iconSize 是 atlas 像素单位,instanceScale 来自 IconLayer vertex shader 主流程
//    X: 正向 = 屏幕右移 → UV 减小(采样左侧)
//    Y: deck.gl IconLayer 末尾 pixelOffset.y *= -1.0 翻转,UV 同步翻转
vec2 translateInUV = mixture.mixtureIconTranslate / (iconSize * instanceScale);
translateInUV.y = -translateInUV.y;
mixtureUV -= translateInUV;

// 4. 写入 vMixtureTextureCoords (原始纹理 UV)
vMixtureTextureCoords = mix(
  instanceIconFrames.xy,
  instanceIconFrames.xy + iconSize,
  mixtureUV
) / icon.iconsTextureDim;

// 4a. 输出 sprite-local UV,供 fragment shader 做越界判断
//     iconScale < 1 时 mixtureUV 会超出 [0, 1],若直接采样将读到 atlas 中相邻精灵
vMixtureUV = mixtureUV;

// 5. 计算每个状态纹理在当前 fragment 位置的 UV
//    状态 i 位于首行第 (i+1) 列:X 偏移 = (i+1) * (iconSize.x + mixtureIconGap),Y = 0
//    状态纹理不参与缩放/平移,使用与 quad 相同的 quadUV
for (int i = 0; i < MIXTURE_MAX_STATE_BITS; ++i) {
  float x = float(i + 1) * (iconSize.x + mixture.mixtureIconGap);
  vec2 stateRawCoord = vec2(x, 0.0);
  vMixtureStateCoords[i] = mix(
    stateRawCoord,
    stateRawCoord + iconSize,
    quadUV
  ) / icon.iconsTextureDim;
}
`,
      },
    }
  }

  override draw(opts: Parameters<IconLayer<MarkerThin, MixtureIconLayerProps>['draw']>[0]) {
    const { iconScale = 1, iconTranslate = [0, 0], bottomMask = 0, topMask = 0 } = this.props
    const model = this.state.model
    if (model) {
      model.shaderInputs.setProps({
        mixture: {
          mixtureIconScale: iconScale,
          mixtureIconTranslate: iconTranslate,
          mixtureBottomMask: bottomMask,
          mixtureTopMask: topMask,
          // 与 stores/icon/render.worker.ts 的 DEFAULT_GAP 保持一致
          mixtureIconGap: 1,
        },
      })
    }
    super.draw(opts)
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
      getSize: 40,
      updateTriggers: {
        getPosition: param.offset,
      },
    })
  }

  override renderLayers(): Layer | null | LayersList {
    console.log('renderLayers')
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
