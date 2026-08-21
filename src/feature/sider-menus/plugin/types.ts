import type { Component, VNode } from 'vue'

/**
 * 侧边栏布局类型：左侧边条中按钮的纵向分区。
 * - `top`    → 顶部主区（可上下滚动，flex-1）
 * - `bottom` → 底部固定区（收缩，shrink-0）
 */
export type SiderLayout = 'top' | 'bottom'

/**
 * 拓展面板渲染上下文：宿主（SiderMenus）在渲染每个打开的面板时注入。
 * 面板经 `SiderPanel` 工厂收到该对象，可读取/更新宿主持有的全局上下文
 * （当前为地图分区 code），或直接用 `ctx.h` 手写 VNode。
 */
export interface SiderPanelContext {
  /** Vue 的 `h` 函数，便于面板在纯函数式工厂里构造 VNode */
  h: typeof import('vue').h
  /** 当前地图分区 code（仅地图上下文面板需要） */
  areaCode?: string
  /** 更新分区 code；不持有该上下文的面板可忽略 */
  setAreaCode?(code?: string): void
}

/**
 * 拓展面板：
 * - 组件形式 → 宿主以 `<component :is>` 直接挂载，无需额外 props；
 * - 工厂函数形式 → 宿主以 `SiderPanelContext` 调用，可精确绑定宿主上下文 prop/事件。
 */
export type SiderPanel = Component | ((ctx: SiderPanelContext) => VNode | Component)

/**
 * 侧边栏条目插件 manifest（对齐 `defineFilter` / `defineLayerPlugin` 风格）。
 *
 * 一条「侧边栏条目」= 一个可独立挂卸的 UI 贡献：声明按钮图标、名称、
 * 布局分区、排序权重与（可选的）拓展面板。内核宿主只消费这份 manifest，
 * 新增/移除条目通过注册中心 `registerSiderItem` / `unregisterSiderItem` 完成，
 * 不修改宿主源码 —— 对齐 Proposal 1 的开闭原则。
 */
export interface SiderItem {
  /** 全局唯一 id，用作注册键、选择键与调试标识 */
  id: string
  /** 按钮名称：i18n key（宿主以 `t(name)` 解析展示） */
  name: string
  /** 按钮图标组件 */
  icon: Component
  /** 布局分区：`top`（顶部）或 `bottom`（底部） */
  layout: SiderLayout
  /** 同分区内的排序权重，升序靠前（`order` 相等时保持注册序） */
  order: number
  /** 拓展面板（可选）。缺省时条目仍可选中，宿主展示「空面板」占位 */
  panel?: SiderPanel
}