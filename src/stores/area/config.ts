import type { AreaVo } from '@/api/services/main/globals'
import Bottleland from '@/assets/area/Bottleland.png'
import ChenyuVale from '@/assets/area/ChenyuVale.png'
import DomusAurea from '@/assets/area/DomusAurea.png'
import Dragonspine from '@/assets/area/Dragonspine.png'
import Enkanomiya from '@/assets/area/Enkanomiya.png'
import Fontaine from '@/assets/area/Fontaine.png'
import GoldenAppleArchipelago from '@/assets/area/GoldenAppleArchipelago.png'
import Inazuma from '@/assets/area/Inazuma.png'
import LiYue from '@/assets/area/LiYue.png'
import Mondstadt from '@/assets/area/Mondstadt.png'
import Natlan from '@/assets/area/Natlan.png'
import NodKrai from '@/assets/area/NodKrai.png'
import Simulanka from '@/assets/area/Simulanka.png'
import Sumeru from '@/assets/area/Sumeru.png'
import SumeruDesert from '@/assets/area/SumeruDesert.png'
import TempleOfSpace from '@/assets/area/TempleOfSpace.png'
import TheChasm from '@/assets/area/TheChasm.png'
import ThreeRealmsGatewayOffering from '@/assets/area/ThreeRealmsGatewayOffering.png'
import Volcano from '@/assets/area/Volcano.png'

interface AreaIconEntry {
  /** 地区 code：C:XX（根地区）或 A:XX:YY（子地区） */
  code: string
  /** 兜底图标 */
  icon: string
}

/** 内置兜底地区图标配置（唯一数据源） */
const areaIconList: AreaIconEntry[] = [
  { code: 'C:MD', icon: Mondstadt }, // 蒙德
  { code: 'A:MD:XUESHAN', icon: Dragonspine }, // 蒙德·龙脊雪山

  { code: 'C:LY', icon: LiYue }, // 璃月
  { code: 'A:LY:CENGYAN', icon: TheChasm }, // 璃月·层岩巨渊
  { code: 'A:LY:CHENYUGU', icon: ChenyuVale }, // 璃月·沉玉谷

  { code: 'C:DQ', icon: Inazuma }, // 稻妻
  { code: 'A:DQ:YUANXIAGONG', icon: Enkanomiya }, // 稻妻·渊下宫
  { code: 'A:DQ:SANJIE', icon: ThreeRealmsGatewayOffering }, // 2.5 稻妻·三界路飨祭

  { code: 'C:XM', icon: Sumeru }, // 须弥
  { code: 'A:XM:DESERT', icon: SumeruDesert }, // 须弥·沙漠

  { code: 'C:FD', icon: Fontaine }, // 枫丹
  { code: 'A:FD:ANCIENT_SEA', icon: DomusAurea }, // 枫丹·旧日之海(雷穆利亚)

  { code: 'C:NATA', icon: Natlan }, // 纳塔
  { code: 'A:NATA:NATA4', icon: Volcano }, // 纳塔·远古圣山

  { code: 'C:NDKL', icon: NodKrai }, // 挪德卡莱

  { code: 'C:APPLE', icon: GoldenAppleArchipelago }, // 金苹果群岛
  { code: 'A:APPLE:1_6', icon: GoldenAppleArchipelago }, // 1.6 金苹果群岛
  { code: 'A:APPLE:2_8', icon: TempleOfSpace }, // 2.8 金苹果群岛(幽夜高城)
  { code: 'C:VELURIYAM', icon: Bottleland }, // 3.8 琉形蜃境
  { code: 'C:SIMULANKA', icon: Simulanka }, // 4.8 希穆兰卡
]

/** 根地区（C:XX）兜底图标映射 */
export const BUILTIN_ROOT_FALLBACK = new Map<string, string>()
/** 子地区（A:XX:YY）专项兜底图标映射 */
export const BUILTIN_CHILD_FALLBACK = new Map<string, string>()

for (const { code, icon } of areaIconList) {
  if (code.startsWith('C:')) BUILTIN_ROOT_FALLBACK.set(code, icon)
  else BUILTIN_CHILD_FALLBACK.set(code, icon)
}

/**
 * 获取地区实体的兜底图标（纯函数）。
 *
 * 优先级：
 * 1. 若地区自身/父级携带专属 iconId，返回 undefined，交由调用方渲染 iconId；
 * 2. 子地区（A:XX:YY）命中专项兜底配置则返回该图标；
 * 3. 未命中则通过 parentId 寻找父级，父级有 iconId 时返回 undefined；
 * 4. 仍无则回退到所属根地区（C:XX）的兜底图标，没有则返回 undefined。
 */
export function getFallbackIcon(
  area: AreaVo,
  areaIdMap: Map<number | undefined, AreaVo>,
): string | undefined {
  const { code, iconId, parentId } = area

  if (!code) {
    console.log('[getFallbackIcon] no code', area.name, undefined)
    return undefined
  }
  if (iconId !== undefined && iconId > 0) {
    console.log('[getFallbackIcon] iconId > 0', area.name, undefined)
    return undefined
  }

  // 根地区 C:XX
  if (code.startsWith('C:')) {
    const rootFallback = BUILTIN_ROOT_FALLBACK.get(code)
    console.log('[getFallbackIcon] rootFallback', area.name, rootFallback)
    return rootFallback
  }

  // 子地区 A:XX:YY：先取专项兜底配置
  const childFallback = BUILTIN_CHILD_FALLBACK.get(code)
  if (childFallback) {
    console.log('[getFallbackIcon] childFallback', area.name, childFallback)
    return childFallback
  }

  // 通过 parentId 寻找父级，父级有专属图标则交由调用方渲染
  if (parentId !== undefined && parentId > 0) {
    const parent = areaIdMap.get(parentId)
    if (parent?.iconId !== undefined) {
      console.log('[getFallbackIcon] parent iconId > 0', area.name, undefined)
      return undefined
    }
  }

  // 回退到所属根地区 C:XX
  const rootCode = `C:${code.slice(2).split(':')[0]}`
  const allFallback = BUILTIN_ROOT_FALLBACK.get(rootCode)
  console.log('[getFallbackIcon] allFallback', area.name, allFallback)
  return allFallback
}
