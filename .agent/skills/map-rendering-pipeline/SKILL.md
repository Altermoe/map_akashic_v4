---
name: map-rendering-pipeline
description: 点位渲染全链路：数据获取 → Worker 解码 → 图标 WebGPU 合批 → 筛选 → deck.gl 图层渲染与 shader 混合。
when-to-use: 任务涉及点位/marker 渲染、图标 atlas、MixtureIconLayer、GLSL 着色器、渲染性能、ICON_STATE 状态位、图标纹理合批。
---

# 技能：点位渲染全链路

## 1. 全链路总览

```
主服务 API（alova，gzip + protobuf）
  → decode.worker（protobufjs 解码 → MarkerThin[] 瘦身）
  → marker store（indexList + itemMarkerIndex 反查索引）
  → icon store（render.worker：下载图标 → WebGPU 绘制 atlas → mapping）
  → filter store（pipeline 筛选 + 按 pos[1] 伪深度排序）
  → genshin-map（GenshinMarkerLayer → MixtureIconLayer → GPU 混合）
```

## 2. 关键文件索引

| 环节 | 文件 | 要点 |
| --- | --- | --- |
| API 配置 | `src/api/services/main/index.ts` | alova 实例；`marker_doc.listMarkersByBinary` 解压为 ArrayBuffer；`icon_doc.listAllIconBinary` 解压为 JSON |
| 解码 | `src/stores/marker/decode.ts`（纯函数）+ `decode.worker.ts`（transport） | `MarkerVoList.decode` → `MarkerThin`：`id/name/pos/icon/isOverlay/itemIds`；纯函数可直接在 node 测试 |
| 点位 store | `src/stores/marker/index.ts` | `indexList`（shallowRef）、`itemMarkerIndex`、下载/解码进度接入 asyncStore |
| 图标合批 | `src/stores/icon/render.worker.ts`（transport/WebGPU）+ `atlas-layout.ts`（纯布局数学） | WebGPU 渲染 atlas；`mapping[id]`；fallback 为 `mapping[-1]`；IndexedDB 结果缓存 |
| 图标 store | `src/stores/icon/index.ts` | `ICON_STATE` 枚举；`textureUrl`（atlas ObjectURL）与 `mapping` 提供给图层 |
| 筛选 | `src/stores/filter/index.ts` + `filter-impls/filter-basic.ts` | 反查索引求并集；`result` 按 `pos[1]` 排序 |
| 图层 | `src/feature/genshin-map/layers/genshin-marker-layer/index.ts` | `GenshinMarkerLayer`(Composite) → `MixtureIconLayer`(IconLayer 子类) |
| 着色器 | `src/feature/genshin-map/layers/genshin-marker-layer/mixture-icon-layer.fs.glsl` | bottomMask → 原始纹理 → topMask 混合 |
| 装配 | `src/feature/genshin-map/index.vue` + `elements/marker-layer.vue` | index 0 tile / index 1 marker；props 注入 atlas/mapping |

## 3. 各环节关键事实

### 3.1 数据与解码

- 点位数据是 **gzip 压缩的 protobuf 二进制**（`MarkerVoList`），不是 JSON；解码在 worker 中完成，产出 `MarkerThin` 六字段结构。
- `icon` 字段 = `itemList[0].iconId`（字符串化），`-1` 代表 fallback；**空 `itemList` 时也返回 `-1`**（不要写成 `itemList?.[0].iconId`——`?.` 只对数组短路、不对元素短路，空数组会崩）。
- `isOverlay` = `extra.underground.isUnderground`，决定 topMask 是否叠加「地下点位」图钉。

> **可测缝隙（vitest，`pnpm test`，node 环境）**：渲染链路里的「非结构化 → 结构化」判定抽成了纯模块，测试直接回归，不依赖 canvas/DOM：
> - `src/stores/marker/decode.ts` 的 `decodeMarkerList(bytes)`：golden protobuf → `MarkerThin[]`（测试 `decode.test.ts`）；
> - `src/stores/icon/atlas-layout.ts` 的 `calculateLayout` / `mainIconCell` / `stateCellX` 等纯布局数学（测试 `atlas-layout.test.ts`），`stateCellX(i)=(i+1)*pitch` 与陷阱 3 的 shader 首行列序互相锁定。
> - 筛选（`filter-impls/*`）用 seam 替换 store（`vi.mock` 注入 fake `itemMarkerIndex` / `typeItemIds`）在 node 测纯逻辑。
> 改动这批纯模块时跑 `pnpm test` 相关用例即可；WebGPU / deck 本体不入单测。

### 3.2 图标 atlas 合批（render.worker）

- 布局：atlas **第 0 行 = fallback + 状态纹理**（第 1 列为 unknown，第 i+1 列为 state[i]），图标从第 1 行铺开。
- 单元：`DEFAULT_SIZE=64`，`DEFAULT_GAP=1`；contain 适配（等比缩放居中）。
- 产物：`{ texture: Blob(png), mapping }`；结果按图标列表+状态列表排序后 JSON 为 key 缓存 IndexedDB（`icon-render:` 前缀）。
- 失败降级：图标下载失败 → `mapping[id]` 指向 fallback 区；资源走 `getCacheableAsset`（OPFS 缓存）。

### 3.3 筛选

- `filter-basic` 用 `itemMarkerIndex`（itemId → Set<markerId>）求并集，避免全量扫描。
- 结果按 `pos[1]` 升序 → 2.5D 地图的伪深度排序（下方点位先画）。

### 3.4 渲染与混合

- `MixtureIconLayer` 继承 deck.gl `IconLayer`，在 vertex shader 注入 `iconScale=0.54` 缩放与 `iconTranslate` 平移；per-instance `instanceBottomMask/instanceTopMask` 经 `flat` varying 传 fragment。
- fragment 混合顺序：`bottomMask 状态 → 原始图标 → topMask 状态`，纯 alpha mix。
- 状态纹理 UV：`(i+1) * (iconSize.x + gap)`（首行）；`MIXTURE_MAX_STATE_BITS` 为编译期常量（`maxStateBits` prop，默认 8）。
- uniform 经 `mixtureUniforms` shader module（std140 block）注入；`iconScale<1` 时 UV 越界由 `isSafe` 抹零。

## 4. 常见修改点与陷阱（改前必读）

### ⚠️ 陷阱 1：位掩码三处不同步

`ICON_STATE`（`src/stores/icon/index.ts`）的位定义 ↔ render.worker 首行状态列序 ↔ shader `(i+1)*(iconSize+gap)` 采样列，三者一一对应。
新增状态（如「已收集」）必须：

1. `ICON_STATE` 增加条目（bit = 1 << index）；
2. `getTopMask`/`getBottomMask`（genshin-marker-layer）按新 bit 返回；
3. 回归渲染（开发页 `worker-marker-state.vue` / 地图页）。

### ⚠️ 陷阱 2：deck.gl 内部变量依赖

vs 注入使用了 `iconSize`、`instanceScale`、`instanceIconFrames`、`icon.iconsTextureDim` 等 **IconLayer 内部变量名**。升级 deck.gl 前必须先验证 marker 渲染；破裂时优先收敛到带注释的适配函数，而不是改 shader 字符串。

### ⚠️ 陷阱 3：混合是「叠加」不是「替换」

当前 shader 无条件 `mix(texColor, originalColor, originalColor.a)` —— 表达不了「点位已标记 → 替换为 active 图标」的语义。TDD-7 的 active/inactive 变体落地时需引入「原始纹理透传开关」或替换路径，而不是硬塞进现有 mask 位。

### ⚠️ 陷阱 4：图层整体重建

`elements/marker-layer.vue` 目前每次数据变化都 `new GenshinMarkerLayer` 替换 layers[index]（已知问题）。**不要在此基础上再加「每次变化新建」的依赖**；未来优化方向是固定 layer id + props/updateTriggers 驱动。

### ⚠️ 陷阱 5：mapping 键与 icon 字段

`marker.icon` 是字符串（`${iconId}`），`mapping` 键是数字——靠 JS 对象键字符串化工作；`-1` 是 fallback 魔法值。改动涉及 `getIcon`/`mapping` 时保持该约定一致。

## 5. 验证方式

1. `pnpm check:type` + `pnpm lint`。
2. `pnpm dev` 打开地图页：点位正常显示、状态图标（地下点位图钉）正确、筛选后图层正确更新。
3. 开发页 `src/pages/development/`（`map-filter` / `marker-texture-render` / `worker-marker-state`）用于链路冒烟。
4. 性能回归：DevTools Performance 观察渲染帧率与内存；确认交互期间 pick 关闭。
5. 改动 atlas/合批后，清理 IndexedDB（`icon-render` 命名空间）再验证，避免命中旧缓存。

## 6. 相关文档

- 设计：`tdds/2-data-models.md`、`tdds/5-data-doc.md`、`tdds/7-icon-data.md`
- 红线：`.agent/rules/architecture.md`（第 2 节第 2、3、4 条）
- 已知问题：`.agent/memory/known-issues.md`
