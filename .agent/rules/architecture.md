# 规则：架构约束（红线）

> 本文件描述项目核心数据流与不可破坏的结构性约束。**改动前必读**；涉及点位渲染时配合 [map-rendering-pipeline 技能](../skills/map-rendering-pipeline/SKILL.md) 使用。

## 1. 核心数据流（唯一正道）

```
主服务 API（alova，gzip+protobuf）
  → Worker 解码瘦身（decode.worker → MarkerThin[]）
  → Pinia store（marker / icon / filter）
  → deck.gl 渲染（GenshinMarkerLayer → MixtureIconLayer）
```

> 澄清：上述环节次序是正道，**不可绕行**；但每个环节内部允许以 seam 方式做 Provider 替换（如数据源 mock/OPFS、不同合批后端），以不改变环节次序为前提。

### 各环节职责与文件

| 环节 | 位置 | 职责 |
| --- | --- | --- |
| API 层 | `src/api/services/main/index.ts` | alova 实例、访客登录、gzip 解压 transform、L2 缓存 |
| 二进制解码 | `src/stores/marker/decode.worker.ts` | protobufjs 解码 → `MarkerThin`（只留渲染/筛选必需字段） |
| 图标合批 | `src/stores/icon/render.worker.ts` | 下载图标 → WebGPU 绘制 atlas → `{texture, mapping}` |
| 状态 store | `src/stores/{marker,icon,filter}.ts` | 响应式数据、反查索引、筛选 pipeline |
| 渲染层 | `src/feature/genshin-map/` | deck.gl 图层（tile + marker）与交互 |

## 2. 红线（违反视为架构错误）

1. **禁止把完整数据模型塞进响应式渲染**：点位必须经 decode.worker 瘦身为 `MarkerThin`；`MarkerVo`（含 Long/大字段）不得直接进 deck.gl data 或 Vue 响应式。
2. **禁止绕过图标合批**：图标渲染必须走 icon store 的 render worker 产出 atlas + mapping；不得为每个图标单独创建 GPU 纹理/图层。插件贡献的状态纹理同样必须经 render.worker 合批进 atlas 首行（经注册中心换算为 bit + 首行 UV），**不得**为插件状态单独建纹理/图层。
3. **位掩码 ↔ atlas ↔ shader 常量一致性由注册中心统一维护，且动态生成**：`ICON_STATE` 位定义（`src/stores/icon/index.ts`）与 shader 首行状态列序（`mixture-icon-layer.fs.glsl` 中 `(i+1)*(iconSize+gap)`）一一对应。**同一个渲染图层实例内**，新增/调整内置状态仍需保持三处一致（`ICON_STATE` → render.worker 布局 → shader 掩码循环）并回归渲染；但该一致性**收敛到 MarkerState 注册中心负责**：插件动态增/减状态时，JS 层按「当前所有已注册状态的并集」重新计算 `maxStateBits`，并**运行时重新生成 `MixtureIconLayer` 及编译其 shader**（`MIXTURE_MAX_STATE_BITS` 随图层实例重建而重编译），**不把状态数写死为预留最大值**。禁止绕过注册中心自行加 bit / 手改 shader 常量。**边界**：仅「状态集结构变化」（插件 `states` 增/减，bit 数 / `maxStateBits` 变化）才重建图层并重编译 shader；「同一状态集内掩码值变化」（如 `hoverId`/`activeId` 变了，bit 数不变）走 `updateTriggers` 增量更新、不重建（见红线 4）。
4. **图层更新优先 props/updateTriggers 驱动**，避免整体重建图层实例（当前 `elements/marker-layer.vue` 存在整体重建，属已知问题，见 `memory/known-issues.md`；修复时保持兼容）。
5. **worker 通信走统一协议**：`src/utils/worker` 的 `handleRequest` / `invokeWorker`（含超时、进度、transfer、取消）。
6. **资源获取走统一缓存**：图标/瓦片用 `src/api/services/assets` 的 `getCacheableAsset` / `getTile`（OPFS + 写锁 + 错误缓存）；接口数据用 alova L2（IndexedDB）。不得另起一套缓存。
7. **环境变量必须入 schema**：新增 `VITE_*` 变量需同步 `envs/schema.ts`（zod 校验，Vite 启动强校验）。
8. **生成文件勿手改**（列表见 code-style.md 第 6 节）。
9. **页面路由用文件路由**：`src/pages/` 下新建文件即路由；开发调试页放 `src/pages/development/`（生产构建会排除 `development.vue` 壳）。
10. **store 统一出口 + 运行时可寻址**：内置 store 在 `src/stores/` 创建并从 `src/stores/index.ts` 导出；插件自身的 store **不要求静态导出**，改为经**运行时 store 注册中心按 id** 获取。二者都禁止跨模块直接 import 其他 store 内部文件。

## 3. 既有模式（新代码保持一致）

- **异步任务可观测**：耗时操作（下载/解码/筛选）接入 `useAsyncStore`，获得进度 + 取消（右上角 Popover）。
- **并发防竞态**：重算类逻辑用自增 token + AbortController 失效旧任务（见 filter store `recompute`）。
- **筛选即 pipeline**：新筛选器实现 `FilterImpl`（`defineFilter`）。内置筛选注册进 `builtinFilters`；插件/运行时可经**筛选注册表** register/unregister 动态挂卸，由 filter store 按内置 + 动态的并集按序执行。
- **性能导向**：大数组 `shallowRef`；像素级处理放 Worker；视口交互期间降低 pick 开销（见 `elements/deck-gl.vue`）。

## 4. 分层依赖方向

`feature → components/ui → stores → api/protobuf/shared`，禁止反向依赖（api 不得 import feature；components 不得 import pages）。
