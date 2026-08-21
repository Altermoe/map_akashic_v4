import { h } from 'vue'
import RegularFilter from '@/ui/g-icons/regular-filter.vue'
import RegularLocale from '@/ui/g-icons/regular-locale.vue'
import RegularLocation from '@/ui/g-icons/regular-location.vue'
import RegularSetting from '@/ui/g-icons/regular-setting.vue'
import ItemFilter from '../item-filter/index.vue'
import ItemLocale from '../item-locale/index.vue'
import ItemSetting from '../item-setting/index.vue'
import { defineSiderItem } from './define'
import { hasSiderItem, registerSiderItem } from './registry'
import type { SiderItem, SiderPanelContext } from './types'

/**
 * 内置侧边栏条目（builtin，随内核编入，作为「二开范本」）。
 *
 * 面板采用工厂函数形式：`filter` 需要精确绑定宿主的 `areaCode`（地图分区），
 * 因此从 `SiderPanelContext` 里读取/回写；`locale`/`setting` 无宿主上下文，直接 `h()` 挂组件。
 */
export const builtinSiderItems = [
  defineSiderItem({
    id: 'filter',
    name: 'filter',
    icon: RegularFilter,
    layout: 'top',
    order: 10,
    panel: (ctx: SiderPanelContext) =>
      h(ItemFilter, {
        'areaCode': ctx.areaCode,
        'onUpdate:areaCode': (v: string | undefined) => ctx.setAreaCode?.(v),
      }),
  }),
  defineSiderItem({
    id: 'track',
    name: 'track',
    icon: RegularLocation,
    layout: 'top',
    order: 20,
  }),
  defineSiderItem({
    id: 'locale',
    name: 'locale',
    icon: RegularLocale,
    layout: 'bottom',
    order: 10,
    panel: () => h(ItemLocale),
  }),
  defineSiderItem({
    id: 'setting',
    name: 'setting',
    icon: RegularSetting,
    layout: 'bottom',
    order: 20,
    panel: () => h(ItemSetting),
  }),
] as const

/** 内置条目元组类型 */
type BuiltinSiderItem = (typeof builtinSiderItems)[number]
/** 内置条目 id 联合（供宿主/调用方作为选择键的期望值） */
export type BuiltinSiderItemId = BuiltinSiderItem['id']

/** 把尚未注册的内置条目注册进注册中心（幂等），返回 unregister 列表。 */
export function registerBuiltinSiderItems(): Array<() => boolean> {
  const unregister: Array<() => boolean> = []
  for (const item of builtinSiderItems) {
    if (!hasSiderItem(item.id)) unregister.push(registerSiderItem(item as SiderItem))
  }
  return unregister
}
