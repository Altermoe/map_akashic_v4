# 开发轮次账本（追加式，勿改写历史）

> 每轮收尾追加一条：**目标 / 本轮做了什么 / 验证 / 遗留**。3-5 句、带指针，够下一个会话续上即可。
> 过长时把旧段迁到 `history/`，正文只留当前。轮次从「第 1 轮」起编。

## 2026-08-21 第 1 轮 — AI Coding 基建：新增开发进度账本技能

- **目标**：让任意会话三秒定位「开发到哪一步」，并强制每次开发任务的前-中-后动作。
- **本轮做了什么**：
  - 设计并落盘进度账本目录 `progress/`（`STATUS.md` / `TODO.md` / `ROUNDS.md` + `history/`），按当前项目状态播种（Phase 1 收尾、Phase 2 起步、已知问题 KI-xx 映射）。
  - 新增技能 `development-progress`（前-中-后强制动作 + 账本约定），登记进 `skills/README.md`。
  - `AGENTS.md`「开始干活前」增加读 `STATUS.md` 一步；`standard-task.md` 的 前置/收尾 挂接账本读写。
- **验证**：纯文档改动——无代码验证面；已核对链接 `agent/skills/*/SKILL.md`、`progress/*` 均存在（详见技能「验证方式」节的文档链接自检）。
- **遗留/下一步**：见 `STATUS.md`「下一步」与 `TODO.md`「横切/基建」= 引入 vitest 最小测试（KI-03）。
## 2026-08-21 第 2 轮 — 侧边栏系统插件化重构

- **目标**：为侧边栏设计并落地插件化架构，可注册图标/名称/布局类型（top/bottom）/order/拓展面板。
- **本轮做了什么**：
  - 新增 `src/feature/sider-menus/plugin/`：`types.ts`（`SiderItem`/`SiderLayout`/`SiderPanel`/`SiderPanelContext`）、`define.ts`（`defineSiderItem`）、`registry.ts`（响应式注册中心：`registerSiderItem`→unregister 可逆副作用 + `siderItems`/`siderItemsByLayout` computed + 查询/清空）、`builtins.ts`（filter·track·locale·setting + 面板工厂）、`index.ts` 出口。零 UI 依赖，纯逻辑可单测。
  - 新建宿主 `sider-menus/index.vue`：挂载时 `registerBuiltinSiderItems()`（幂等）、卸载撤销；按 `siderItemsByLayout.top/.bottom` 渲染按钮，右侧渲染选中条目的 panel（无 panel 占位）；`v-model:area-code` 注入 `SiderPanelContext`。
  - 迁移 `sider-button/collapse-button` 至 `sider-menus/components/`，删除旧 `genshin-map/components/sider-toolbar/`；`genshin-map/index.vue` 改用 `SiderMenus` 宿主（去掉硬编码 slot）；清理 `genshin-map/components/index.ts` 旧导出。
  - `sider-menus/README.md` 补齐插件架构文档。
- **验证**：`pnpm check:type` 0 error；`pnpm lint` 0 error（仅遗留 `KI-02` protobuf jsdoc warnings）；`pnpm build` ✓ built in 1.75s。
- **遗留/下一步**：vitest 仍未接入（`KI-03`，计划首测对象含 `sider-menus/plugin/registry`）；`registry.ts` 的版本号方案与 HMR 下的内置条目生命周期可后续打磨（见 TODO「横切/基建」）。

## 2026-08-21 第 3 轮 — 引入 vitest 测试闭环（KI-03）

- **目标**：为 WebGIS 应用接入最小 vitest 测试闭环（node 环境，优先覆盖解码 / atlas 布局 / 筛选纯逻辑），让无 DOM 组件的信息可回归、并给 AI 开发装上「跑相关单测」的闸门。
- **本轮做了什么**：
  - 工具骨架：新增 `vitest.config.ts`（独立于 vite.config，默认 node 环境、`@/` 别名、Vue 插件备用；以后 SFC 接线测试再用 jsdom + environmentMatchGlobs）；新增 `pnpm test` / `test:watch`，`precommit` = lint && check:type && test；冒烟 `src/smoke.test.ts`。
  - 抽出可测纯模块（worker 只留 transport）：`decodeMarkerList`（`src/stores/marker/decode.ts`）+ 修 `itemList?.[0]` 空数组崩溃 bug（记入 KI-11）；atlas 布局数学收敛到 `src/stores/icon/atlas-layout.ts`（`calculateLayout`/`mainIconCell`/`stateCellX`/`atlasDimensions`/`fallbackCell`/`iconPitch`），`render.worker.ts` 改用之（去掉本地重复逻辑）。
  - 单测：`decode.test.ts`（golden protobuf → `MarkerThin[]`）、`atlas-layout.test.ts`（方形布局 / 状态行预留 / shader 状态列序一致性）、`filter-basic`、`filter-search`、`filter-custom`（seam 替换 store 注入 fake index）。
  - 同步技能与文档：`map-rendering-pipeline/SKILL.md` 补充「可测缝隙」段 + 空 itemList 陷阱；`AGENTS.md` 常用命令加 test、precommit 闸门更新。
- **验证**：`pnpm test` 6 files / 25 tests 全绿（~217ms）；`pnpm check:type` 0 error；`pnpm lint` 0 error（仅 KI-02 warnings）；`pnpm build` ✓ built in 1.41s。
- **遗留/下一步**：`TODO.md`「横切/基建」补 store 集成（filter store Pinia）、`sider-menus/plugin/registry` 测试、（可选 Step 5）`@vue/test-utils`+jsdom 薄接线层。
