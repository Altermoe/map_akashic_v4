# Proposal 1 — 插件化重构

> 标题：以 deepseek-harness 插件架构思想重构思「本地图」的产品代码组织与 AI 协作开发方式
> 状态：**草案（Draft）** · 属于 Phase 2「协同」的可选方向
> 关联：Phase 4「开放」的 API 与插件化愿景，与本提案同源，可复用同一套 seam 心智模型。

## 0. 我们为什么要改成插件架构

本项目（`map_akashic_v4`）其实已经有不错的模块化：`src/feature/*` 自包含业务模块、`src/stores/*` 唯一出口、`builtinFilters` 已是小型注册表、`.agent/*` 也把渲染链路与技能做了约定。所以这一章要回答的不是"要不要模块化"，而是**为什么模块化还不够、为什么要上升到插件架构**。

### 0.1 不是为了学而学：为了开闭原则（OCP）的落地

把 deepseek-harness 的插件架构搬过来，**不是为了标新立异，而是为了把「开闭原则」这个老原则真正落地**：

> **对扩展开放，对修改关闭。** 新增一个能力 = 新增一份外部贡献；核心渲染源码保持稳定、不因新需求而改动。

模块化可以做到"代码分目录、职责分文件"，但它不承诺一件事：**新增东西不碰旧东西**。当新的瓦片策略、新的交互组件、新的数据类型出现时，模块化通常仍要求你打开核心渲染/筛选源码去加分支、加 switch，这就是"对修改开放"——仓库会随着 feature 增长而逐渐腐化。

插件架构给出的是一条可检验的判据：**每次新增能力，`src/feature/genshin-map`、渲染图层、筛选流水线等核心文件是否零 diff？** 如果是，开闭原则才算落地；这一个判据，就是持续抵抗「架构腐化」的度量。

### 0.2 第一性理由：社区共建

开源项目的长期生命力，**不取决于内核写得有多完美，而取决于外部贡献者能否低成本地加入**。插件架构是"共建友好"的架构：

- 内核（渲染链路、数据流、store 出口）由核心维护者把守，单一责任、稳定演进；
- 外围能力（新图层、新筛选器、新交互、新侧栏条目）由社区各取所需、并行生长；
- 贡献者之间互不阻塞：A 做一个图层插件、B 做一个筛选插件，彼此零耦合，都挂在同一个宿主壳上。

一句话：**插件架构是"把仓库从作坊开放成集市"的机制**。这也正是本项目 Phase 4「开放 / 插件化」愿景的提前布局——现在把 seam 摆对，届时第三方接入是顺势而为，而不是推倒重来。

### 0.3 最具体的动因：Deck.GL 是"原始底层引擎"，二次开发门槛高

Deck.GL（及底下的 luma.gl / WebGPU / WebGL + shader）在 Web 地图应用开发里**是一套相当底层、相当原始的引擎**：

- 直接在其上写一个渲染特性，需要同时掌握：图层生命周期、`updateTriggers` 的按需更新、GPU 纹理/合批、以及 GLSL shader 的掩码混合逻辑（本项目 `mixture-icon-layer.fs.glsl` 的位掩码 ↔ atlas 列序强绑定即是一例）；
- 对不熟悉 WebGL/WebGPU 的二次开发者，这个上手曲线几乎呈断崖。

如果所有渲染能力都必须"改核心源码"才能加，那么**二次开发者事实上被挡在门外**：要么他深入学一套底层引擎，要么他 fork 整个仓库去改人家内核。两者对开源项目都是灾难——前者挡住绝多数贡献者，后者让核心分叉、社区割裂。

插件架构的桥接作用正在于此：**把底层引擎的高门槛，收敛进少量、稳定、文档化的 `render` seam**。二次开发者只需要对着 seam 接口写一个"渲染能力/交互组件"的插件（声明自己消费的数据、挂到自己所属的 slot），而完全不需要碰核心渲染源码。**引擎的复杂给内核，接口的简单给社区。**

### 0.4 更进一步：仓库之外的渲染插件 + 运行时按需安装

正因为能力被建模为"可插拔的贡献"，社区贡献就**不必留在本仓库**，可以与内核的发布节奏彻底解耦：

- 社区可以在自己的仓库里实现一个**渲染插件 / 交互组件包**，声明它需要哪些 seam、挂到哪个 slot；
- 用户（或地图的后台）在**运行时按需安装**它——已装的插件以 id 注册进宿主壳，可加载、可卸载、可回滚可逆副作用；与内核版本不匹配时通过 seam 接口契约做校验，而不是撞进源码里。

做到这一步，"二次开发"就从"要我改你这个仓库"变成"我写一个你随时能装上、也能卸掉的插件"。这是开源共建的最高形态：**内核稳定到几乎只进 bug 修复，能力全在插件生态里野蛮生长。**

### 0.5 支撑这些目标的 DSH 三件本质

「模块化」我们本来就有；上面四节是"为什么不够、为什么上插件"。而 deepseek-harness 恰好把插件架构的三件本质做干净了，值得对照落地：

1. **无特权内核的贡献式组装** —— 没有"神级 App / 神级 store"，应用是一棵由各层叠加、按 id 可 patch 的插件树（Cordis）。→ 对应 0.1 的开闭原则与 0.4 的按需安装。
2. **能力 seam 三角色分离**（Service Definition / Provider / Consumer）—— 换一个 Provider 就换掉整个产品行为，无需 fork。→ 对应 0.3 的"门槛收敛进 seam"。
3. **事件即扩展点 + 可逆副作用** —— 注册是副作用，卸载即撤销；扩展靠"挂载到旁边"，不靠打补丁内核。→ 对应 0.2 的贡献并行、0.4 的可回滚安装。

> 来源：DSH `docs/architecture.zh.md`、`docs/capability-seams.zh.md`、`packages/README.zh.md`。

---

## 1. 目标与不做什么

### 目标

- 让新增/替换一个"能力"（数据源、筛选器、渲染后端、侧栏条目）成为**挂载一个自包含组合单位**，而不触碰内核。
- 让"换 Provider"（生产 API ↔ 本地 mock/OPFS ↔ 测试桩）在**同一套 Consumer 代码**内完成。
- 让 feature 的组装按**环境 profile** 决定（web / dev / perf），而不是构建时写死。
- 把 AI 协作开发方式升级为：**feature 组合包脚手架 + SKILL 即能力提供方 + 可逆副作用（提交/回滚）**。
- **面向社区与开闭原则**：让二次开发者能在**不修改核心渲染源码**的前提下，仅凭 seam 接口增加渲染能力/交互组件；更进一步支持**仓库之外的渲染插件**在运行时由用户按需安装/卸载（见 §0.4）。

### 不做什么（红线之外的场景不走样）

- **不推翻现有渲染主链路**：`主服务 API → worker 解码 → store → deck.gl` 依旧是唯一正道（见 `.agent/rules/architecture.md`），本提案只在其上架 seam 与事件层。
- **不引入过度抽象**：只为真实变化的点建模 seam；没有第二 Provider 的能力不强行 seam。
- **不改生成文件**（`src/api/**/apiDefinitions.ts`、`src/protobuf/index.*`）。

---

## 2. 概念映射表

| DSH 概念 | 本项目现状 | 升级方向 |
| --- | --- | --- |
| 能力 seam（接口/提供方/消费方） | `architecture.md` 单线渲染链路 | 把渲染、筛选、数据源建模为 seam |
| 无特权内核、注册贡献 | store 唯一出口、`builtinFilters` 注册表 | 推到"注册表 + 可逆副作用 + waterfall" |
| 事件即扩展点 | `useAsyncStore`（进度+取消）、`recompute` token | 统一成类型化能力事件总线 |
| profile / 组合包 / patch | `envs/.env.*.local` env 分层 | 按 profile 组装 feature + feature 级 patch |
| 可逆副作用（卸载撤销） | feature 自包含、未声明挂载/卸载边界 | feature 附带 **register/cleanup** |
| 依赖方向（只依赖 Definition） | 红线 4 分层依赖 | 加强为"只依赖 seam 接口，不依赖具体 Provider 包" |
| Client slot / navigation node | `sider-menus/item-{filter,setting,locale}` | 形式化 UI slot 注册表 |
| Agent 原生扩展（model 写插件） | `.agents/skills` 符号链接桥接 | feature 自带 SKILL.md，DSH 可加载"该能力提供方文档" |

---

## 3. 运行时侧：地图 = 宿主壳 + 一组可插拔能力

### 3.1 渲染链路 seam

把主链路建模为三个可替换 seam，三角色分离成独立文件：

```text
数据源 seam   DataSource (Definition): () => AsyncIterable<MarkerSource>
                 ├─ Provider: alova main API（现状 src/api/services/main/index.ts）
                 ├─ Provider: 本地 OPFS / mock（开发 / 离线 / 回归测试）
                 └─ Consumer: marker store —— 只吃 MarkerFeed 协议

解码 seam     Decoder (Definition): MarkerSource => Promise<MarkerThin[]>
                 ├─ Provider: decode.worker（生产，src/stores/marker/decode.worker.ts）
                 └─ Provider: inline decode（E2E / 纯逻辑测试）

合批 seam     IconAtlasBuilder (Definition): 图标流 => {texture, mapping}
                 ├─ Provider: WebGPU render.worker（src/stores/icon/render.worker.ts）
                 └─ Provider: WebGL fallback（低端机回退）
```

**验收标准**：把 `DataSource` 从"alova 生产 API"切到"OPFS mock"后，`decode.worker`、store、deck.gl 图层**零改动**。

### 3.2 筛选 seam（从雏形升级）

现状已是注册表 + 按序执行（`FilterImpl` / `defineFilter` / `builtinFilters`），再补三层：

1. **可逆副作用**：`defineFilter` 出 `unregister`，随 feature 挂载/卸载；
2. **waterfall 语义**：仿 DSH `tools/*` 事件，筛选器间可"委托/短路"，而非纯顺序；
3. **作用域化**：仿 Cordis 隔离 realm，"选区筛选"与"图标状态筛选"归属不同作用域。

### 3.3 统一能力事件总线

把散落的回调/竞态提升为一张类型化总线（如 `src/core/events.ts`）：

- **能力事件**（桥接各 seam，无 import 环）：`maps/decode-progress`、`maps/tile-loaded`、`maps/icon-atlas-built`、`maps/filter-changed`、`maps/pick`；
- **持久事实**（可序列化/回放，可落到 localStorage/IndexedDB）：`maps/ready`、`maps/region-changed`、`maps/filter-applied`。

> 对标 DSH"模型可见即已记录"：当前筛选/地区/偏好应定义为**一段可回放的事件日志**，而非易失响应式状态。

### 3.4 profile / 组合包 / patch 组装

- **组合包** = 一个自包含 feature（如 `genshin-map`、`user-center`），声明自己需要的 seam、贡献的 UI slot 与 store；
- **profile** = 组装模板：`web`（全量 feature）/ `dev`（+ `pages/development` 调试）/ `perf`（仅渲染链路跑性能回归）；
- **patch** = 按 feature id 覆写配置，对应扩展 `envs/.env.*.local` 的思想到 feature 级。

---

## 4. AI 协作开发侧

1. **feature 组合包脚手架**：「新增一个地图 feature」从手写模板升级为**可生成脚手架**。生成时一次接好：渲染/筛选 seam 接口、store 出口、i18n、slot 注册、测试。
2. **SKILL 即能力提供方**：每个 feature 自带 `SKILL.md`（该模块的本地规约），经 `.agents/skills` 桥接进 DSH skill-filesystem —— "加载 feature 技能" = "加载该能力提供方文档"。
3. **可逆副作用 = 提交/回滚**：commit 视为一次可逆副作用注册，`pnpm check:type` + `pnpm lint` 是"卸载前校验"。
4. **按 profile 组装 agent preset**：渲染任务 = `map-rendering-pipeline` skill + `rendering-specialist` 角色 + `perf` profile 验证命令。

---

## 5. 落地路径（Proposed Milestones）

| 里程碑 | 范围 | 验证 |
| --- | --- | --- |
| S0 文档对齐（本文稿） | 补 seam 图、事件总线、profile 定义 | 评审通过 |
| S1 筛选 seam 试点 | 升级 `defineFilter` 为可逆 + waterfall | 既有筛选器回归 + 新增/卸载一个筛选器 |
| S2 数据源 seam 试点 | 加 OPFS/mock Provider，Consumer 零改动 | 切 Provider 后渲染链路行为一致 |
| S3 feature 脚手架 + profile 组装 | 新增 feature 生成模板 + web/dev/perf profile | 生成一个新 feature 并接入 |
| S4 能力事件总线接入 | `src/core/events.ts` 替换散落回调 | 事件可回放、无 import 环 |

> 建议按 S1 → S2 小步验证本套思想在本项目成立，再决定是否推进 S3/S4。

---

## 6. 风险与取舍

- **过早抽象**：只为真实有第二 Provider 的点建 seam，否则退化为无用分层。以 S1/S2 的"真实验证"作为推进闸门。
- **事件总线过度**：事件太多会变成"上帝总线"。只对"跨 seam 观察或需要可回放的事实"用事件。
- **改动量**：本方案不推翻主链路，是**渐进迁移**，避免一次大爆炸式重构。