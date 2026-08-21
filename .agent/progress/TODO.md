# 开发待办（TODO 清册）

> 按里程碑分块；前-中-后实时维护（做中 `[~]`、完成 `[x]`、阻塞 `[!]` 并在行尾写原因）。
> 每条尽量带可定位指针（`tdds/` 编号、文件路径、`KI-xx`）。来源可溯，避免重复造轮子。

## 当前里程碑：Phase 2 起步 —— 用户系统 / 云端同步

- [ ] **TDD-6 地图存档落地** — 存档/进度同步骨架：数据模型（`PrefData` / `MarkerIdData` / `MarkerRefreshTimeData`）、`src/database` 表、存档列表与单条明细。源：`tdds/6-app-user-save.md`（另有术语/刷新时间格式的 `FIXME`）。
- [ ] **TDD-8 服务器配置核对** — 源：`tdds/8-server-config.md`（现为 TODO 占位，需先补设计）。
- [ ] 用户相关路由 `src/pages/user/[id].vue` 从占位模板落地（当前为最小 SFC 占位）。

## Phase 1 收尾 —— 稳健与性能（可并行）

- [ ] **`KI-04` marker 图层整体重建** → 固定 layer id + props/`updateTriggers` 驱动，避免每次数据变化都 `new GenshinMarkerLayer`。改前读 `map-rendering-pipeline` 技能（陷阱 4）。
- [ ] **`KI-07` 状态混合缺「替换」语义** — 引入原始纹理透传开关/替换路径后再落地 active/inactive 变体。（红线 3：经 MarkerState 注册中心，勿手改 shader 常量）
- [ ] **`KI-09` 图标渲染任务不可取消** — `runRender` 增加 AbortController，复用 asyncStore 模式。
- [ ] **`KI-05` 渲染错误处理不对称** — 解码失败进 asyncStore 失败任务，渲染失败降级占位而非蓝屏。
- [ ] **`KI-08` 无 LOD/聚合** — 按 zoom 稀疏化（TDD-5 分片方案）。影响面大，宜单独设里程碑评估。

## 横切 / 基建

- [ ] **引入 vitest 最小测试闭环**（← 下一步，命中 `KI-03`）：优先 `decode.worker`（golden data）、`calculateLayout`、`filter-basic`。vitest 依赖已在 `package.json`（commit ef54ce0）。落地后在 `AGENTS.md`/`.agent` 补「改动涉及逻辑时跑相关单测」的闸门。
- [ ] **插件化架构跟进** — 图层系统已方向化（commit 7a6da4a）；核对 proposal/1、2 与红线 3/10 是否一致，确定 MarkerState 注册中心与 store 注册中心接口。
- [ ] **补 TDD-4/9 设计占位** — `tdds/4-marker-linkage.md`（点位关联）、`tdds/9-overlay-layers.md`（分层层级）目前为 TODO 占位，排期时先补粗粒度设计。

## 收尾检查（每轮退出前对照）

- [ ] `pnpm check:type` + `pnpm lint` 通过
- [ ] 涉及页面/构建 → `pnpm build` + 受影响开发页冒烟
- [ ] 命中/修复的 `KI-xx` 已更新 `.agent/memory/known-issues.md`
- [ ] 本轮已追加 `ROUNDS.md`，`STATUS.md` 已反映最新进度