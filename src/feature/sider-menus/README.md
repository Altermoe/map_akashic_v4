# sider-menus —— 侧边栏插件架构

> 左侧边条 + 右侧拓展面板，以**插件注册中心**驱动，宿主零硬编码菜单项。

## 心智模型

侧边栏 = 宿主（[`index.vue`](./index.vue)） + 一组可插拔「侧边栏条目」。宿主不关心具体
有哪些菜单，只消费注册中心里已注册的条目并按 `layout` / `order` 渲染按钮与拓展面板。

新增一个菜单项 = `registerSiderItem` 注册一份 manifest；移除即 `unregisterSiderItem`
撤销。宿主源码零改动 —— 对齐 Proposal 1 的开闭原则与「引擎复杂给内核、接口简单给社区」。

## 目录

```
sider-menus/
├── index.vue            # 侧边栏宿主：读注册中心 → 渲染按钮 + 拓展面板
├── components/
│   ├── sider-button.vue     # 单个侧边栏按钮（图标 + 名称）
│   └── collapse-button.vue  # 折叠控制按钮
├── item-*/                 # 各条目面板组件（filter / locale / setting …）
└── plugin/                 # 插件化 seam（二开入口）
    ├── types.ts            # SiderItem / SiderLayout / SiderPanel / SiderPanelContext
    ├── define.ts           # defineSiderItem 工厂（字面量类型校验与推导）
    ├── registry.ts         # 运行时注册中心（register/unregister 可逆副作用 + 响应式分组）
    ├── builtins.ts         # 内置条目 filter / track / locale / setting
    └── index.ts            # 统一出口
```

## 条目 manifest（`SiderItem`）

| 字段 | 说明 |
| --- | --- |
| `id` | 全局唯一，注册键 / 选择键 |
| `name` | 按钮名称，i18n key（宿主 `t(name)` 解析） |
| `icon` | 按钮图标组件 |
| `layout` | 布局分区：`top`（顶部主区，可滚动） / `bottom`（底部固定区） |
| `order` | 同分区内排序权重，升序靠前 |
| `panel` | 拓展面板（可选）。组件形式直接挂载；工厂函数形式接收 `SiderPanelContext`，可精确绑定宿主上下文（如地图 `areaCode`） |

## 二开示例

组件形式（无宿主上下文的面板）：

```ts
import { defineSiderItem, registerSiderItem } from './plugin'
import MyPanel from './my-panel.vue'

const my = defineSiderItem({
  id: 'my-menu',
  name: 'myMenuTitle',          // i18n key
  icon: RegularMyIcon,
  layout: 'top',
  order: 30,
  panel: MyPanel,               // 组件形式
})
const unregister = registerSiderItem(my)
// …… / unregister()
```

工厂函数形式（需要宿主上下文，如地图分区 code）：

```ts
import { h } from 'vue'
panel: (ctx) => h(MyPanel, {
  areaCode: ctx.areaCode,
  'onUpdate:areaCode': (v) => ctx.setAreaCode?.(v),
})
```

## 注册中心（`registry.ts`）

- `registerSiderItem(item) → unregister`：可逆副作用 —— 注册返回撤销函数，随挂载/卸载回收；
- `siderItems` / `siderItemsByLayout`：响应式 `computed`，宿主订阅后条目注册/注销即触发 UI 重渲染；
- `hasSiderItem` / `getSiderItem` / `getSiderItems` / `getSiderItemsByLayout`：查询；
- `clearSiderItems`：清空（测试/热载）。
- 模块**零 UI 依赖**，纯逻辑可单测。

## 宿主（`index.vue`）

- 挂载时 `registerBuiltinSiderItems()`（幂等），`onUnmounted` 撤销 —— 可逆副作用落地；
- 按 `siderItemsByLayout.top`（顶部）与 `.bottom`（底部）渲染 `SiderButton`；
- 右侧仅渲染当前选中条目的 `panel`（无 `panel` 时展示「空面板」占位）；
- `v-model:area-code` 透传给需要地图分区上下文的面板。

## 配套

- 设计：`proposal/1-plugin-architecture.md`、`proposal/2-marker-state-plugin.md`
- 红线：`.agent/rules/architecture.md`（分层依赖：feature → components/ui → stores，禁止反向）