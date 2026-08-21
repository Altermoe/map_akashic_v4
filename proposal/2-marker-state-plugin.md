# Proposal 2 — 点位图层 hover/active 状态与插件化

> 标题：为 MarkerLayer 补齐 hover / active 状态，并做成插件架构下的 builtin 示例，说明「二开不碰内核渲染源码」即可强化点位图层
> 状态：**草案（Draft）** · 属于渲染链路的能力增强，与 Proposal 1（插件化重构）配套
> 参考：同组织 v3 实现（`kongying-tavern/map_register_v3`，本地镜像 `/home/cyrene/codes/_ref_map_register_v3`）

## 1. 现状诊断（为什么现在是缺口）

| 事实 | 位置 |
| --- | --- |
| `ICON_STATE` 仅 `DEFAULT(0b001)` / `OVERLAY(0b010)`，共 2 位 | `src/stores/icon/index.ts` |
| shader 只支持 bottom / top 两层**叠加**混合（`mix`） | `layers/genshin-marker-layer/mixture-icon-layer.fs.glsl` 2a/2b/2c |
| 已知缺陷：无法「替换为另一图标」，只能叠加不能替换 | `.agent/memory/known-issues.md` |
| `marker-layer.vue` 的 `onClick/onHover` 只 `emit`，**不回流到渲染** | `elements/marker-layer.vue` |
| 数据变化触发的层整体 `new GenshinMarkerLayer` 懒重建 | `elements/marker-layer.vue` watchEffect |

**结论**：渲染内核（掩码 + 首行状态纹理机制）本身可承载更多状态，缺三样东西——①状态定义只有 2 个 bit；②只有「叠加」没有「替换」语义；③hover / click 事件没有驱动 mask 的状态源。这三点都是**可补的内核能力**，不是推倒重来，与插件架构「引擎复杂给内核、接口简单给社区」天然契合。

## 2. v3 参照：借鉴什么、不照抄什么

### 值得借鉴（`_ref_map_register_v3`）

- **互斥优先级编码** `getIconFlag`：`focus(0b0100) > marked(0b1000) > hover(0b0010) > default(0b0001)`，再叠 `underground(0b10000)` 层级位（`gsMarkerLayer.ts`）。
- **首行状态纹理 = 一组色块蒙版**：`default 白 / hover #DDD / focus #FF0 / marked #00FFFD`，shader 遍历置位 bit 叠加（`useMarkerTextureRender.ts` + `gsMarkerRenderLayer.fs.glsl`）。
- **`-bottom` / `-top` 双层抬升**：bottom 全量、交互位点透明；top 只画 hover/focus 且不透明 →「抬起遮挡邻点」（`gsMarkerLayer.ts`）。

### 不照抄（v3 局限）

- 状态 one-hot 互斥（一次只能一个态）——V4 的 bitmask 可组合更灵活。
- 状态是纯色蒙版而非整套图标替换——V4 需「替换」语义（见下）。
- 双 GPU 层有开销——默认关闭，按需启用。

## 3. 最佳实现方案（V4，V1 → V2 两档）

### 3.1 内核改造（一次做扎实）

**① 补「替换」语义**（先解 known-issue，hover/active 与 TDD-7 active/inactive 共用）。给 `MixtureIconLayer` 新增第三个 per-instance accessor `getReplaceMask`：命中 bit 的纹理**替换**原始图标，与 `getBottomMask`（底层叠加）/`getTopMask`（顶层叠加）正交。shader 增加替换支路（在原始纹理混合处用替换色覆盖）。

**② 扩充 `ICON_STATE`**：新增 `HOVER(0b100)` → state[2]、`ACTIVE(0b1000)` → state[3]；`maxStateBits` 2 → 4。**三处同步**（技能陷阱 1）：`ICON_STATE` ↔ `render.worker` 首行状态列数 ↔ shader `MIXTURE_MAX_STATE_BITS` 常量。hover/active 纹理可先复用浅灰/高亮蒙版，后续再进整套图标。

**③ 交互状态源**（新建）：`hoverId` / `activeId`（单点）。`marker-layer.vue` 的 `onHover` 写 `hoverId`、`onClick` 写 `activeId`。

**④ 收敛懒重建**：固定 layer 实例，`updateTriggers.getBottomMask/getTopMask/getReplaceMask` 绑定 `[hoverId, activeId]`。这是「悬停不再 new 层」的前提，也是插件接线的基础。

### 3.2 Mask 合成（优先级对齐 v3：active > hover）

```ts
// marker-layer.vue 内合成 per-instance mask
const stateMask = (m: MarkerThin) =>
  activeId === m.id ? IconState.ACTIVE
  : hoverId  === m.id ? IconState.HOVER
  : 0
// bottomMask 保留 0b001 底座；topMask 保留 isOverlay 地下图钉；replaceMask 填入 stateMask
```

### 3.3 两档视觉

| 档位 | 内容 | 成本 | 推荐 |
| --- | --- | --- | --- |
| **V1** | 状态纹理 + 替换掩码；单层内以「替换纹理 + 可选 `iconScale` 放大」表达强调 | 低（不加双层） | ✅ 先做 |
| **V2** | 泛化为两层的 `lift` 抬升遮挡（借鉴 v3），默认关闭，可插拔 | 中（多一次全量绘制） | 按需 |

## 4. 插件化 builtin 示例（核心）

### 4.1 Seam 契约 `MarkerStatePlugin`（二开声明式，对齐 `defineFilter` 风格）

二开者不碰 shader / `ICON_STATE` / `render.worker`，只表达三件事：**什么时候亮、亮什么纹理、怎么表现**。

```ts
// src/feature/genshin-map/plugins/types.ts
export interface MarkerStateContext {
  hoverId?: number
  activeId?: number
  hovered: boolean
  activated: boolean
}

export interface MarkerStatePlugin {
  key: string                                     // 唯一 id
  states?: IconStateResource[]                    // 贡献状态纹理（自动并入 atlas 首行）
  on: (m: MarkerThin, ctx: MarkerStateContext) => boolean
  render?: { layer: 'bottom' | 'top' | 'replace'; blend?: 'overlay' | 'replace'; lift?: number }
  priority?: number                               // 多插件竞态优先级
  customModules?: ShaderModule[]                  // 强二开可选项：注入 vs/fs
}
```

### 4.2 注册中心（可逆副作用）

```ts
// src/feature/genshin-map/plugins/registry.ts
export const markerStateRegistry = {
  register(p: MarkerStatePlugin) {
    // 把 p.states 并入 ICON_STATE + 重排 atlas 首行
    // 把 p.on 挂进 mask 合成（按 priority 排序）
  },
  unregister(p: MarkerStatePlugin) {
    // 撤销上一步（位回收 / 移除 resolver）
  },
}
```

**内核自动收敛「陷阱 1」**：插件声明一个 state，注册中心即换算成 `bit + 首行纹理 UV + 采样层`，自动驱动 `render.worker` 重排与 shader 的 `MIXTURE_MAX_STATE_BITS`。二开者全程不碰渲染源码 —— 对应 Proposal 1 §0.3「引擎的复杂给内核、接口的简单给社区」。

### 4.3 Builtin 示例

```ts
// builtins/builtin-hover.ts —— hover 态插件
import { defineMarkerStatePlugin } from '../define'
import hoverTextureUrl from './marker-hover.png'

export const builtinHover = defineMarkerStatePlugin({
  key: 'builtin-hover',
  states: [{ key: 'hover', url: hoverTextureUrl, bit: 0b100 }],
  on: (_, { hoverId }) => hoverId != null,
  render: { layer: 'replace', lift: 1.2 },
})
```

```ts
// builtins/builtin-active.ts —— active 态插件
import { defineMarkerStatePlugin } from '../define'
import activeTextureUrl from './marker-active.png'

export const builtinActive = defineMarkerStatePlugin({
  key: 'builtin-active',
  states: [{ key: 'active', url: activeTextureUrl, bit: 0b1000 }],
  on: (m, { activeId }) => activeId === m.id,
  priority: 2,                                   // active 高于 hover
  render: { layer: 'replace', lift: 1.35 },
})
```

builtin 插件随内核编入并注册进 `registry`，作为「二开范本」：社区开发者照此形状写自己的 `marker-state` 插件（如「已标记 → 勾选图标」「特殊点位 → 闪烁描边」），注册即获得 atlas 自动并入 + shader 自动采样 + 分层/抬升自动生效。

### 4.4 强弱二开

- **弱二开（主推）**：纯声明式 `on + states + render`，零涉 GLSL。
- **强二开（可选）**：`customModules` 注入 vs/fs，走「强能力」通道，内核保持可选支持。

## 5. 落地路径

| 里程碑 | 范围 | 验证 |
| --- | --- | --- |
| S0 文档对齐（本文稿） | 评审 + seam + builtin 设计 | 评审通过 |
| S1 内核补替换语义 | `getReplaceMask` + shader 替换支路 | 回归 + 新增替换态冒烟 |
| S2 状态扩位 | `ICON_STATE` 加 HOVER/ACTIVE，maxStateBits→4，三处同步 | 清理 `icon-render` 缓存后再验证 |
| S3 交互状态源 + 收敛懒重建 | `hoverId/activeId` + updateTriggers 驱动 | 悬停/选中实时更新，不再 new 层 |
| S4 插件 seam + builtin | registry + defineMarkerStatePlugin + builtin-hover/active | 二开示例驱动同一条内核链路 |

## 6. 风险与取舍

- **陷阱 1 三处同步**：新增 bit 必同步 `ICON_STATE` ↔ render.worker 首行 ↔ shader 常量。
- **shader 展开**：`maxStateBits`→4 会增加循环展开，留意整体性能。
- **V2 双层开销**：默认关闭，按需启用。
- **懒重建收敛**：须先固定 layer 实例，才能让 `updateTriggers` 接管、插件接线生效。