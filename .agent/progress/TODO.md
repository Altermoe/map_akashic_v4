# 开发待办（TODO 清册）

> 按里程碑分块；前-中-后实时维护（做中 `[~]`、完成 `[x]`、阻塞 `[!]` 并在行尾写原因）。
> 每条尽量带可定位指针（`tdds/` 编号、文件路径、`KI-xx`）。来源可溯，避免重复造轮子。

## 当前里程碑：Phase 2 起步 —— 用户系统 / 云端同步

- [ ] **TDD-6 地图存档落地** — 存档/进度同步骨架：数据模型（`PrefData` / `MarkerIdData` / `MarkerRefreshTimeData`）、`src/database` 表、存档列表与单条明细。源：`tdds/6-app-user-save.md`（另有术语/刷新时间格式的 `FIXME`）。
- [ ] **TDD-8 服务器配置核对** — 源：`tdds/8-server-config.md`（现为 TODO 占位，需先补设计）。
- [ ] 用户相关路由 `src/pages/user/[id].vue` 从占位模板落地（当前为最小 SFC 占位）。

## Phase 1 收尾 —— 稳健与性能（可并行）

- [x] **点位加载改为分页并发**（本轮）— `src/stores/marker/index.ts` 弃用全量 `listMarkersByBinary`，改 `listMarkerBinaryMD5` → 并发 `listPageMarkerByBinary`；`useSerialRequest` 锚定「先取清单」，动态分页并发窗（4）；dexie 缓存 manifest（`MANIFEST_TTL`）+ 分页原始二进制（`marker:page:{md5}:{time}`），`purgeStalePages` 清历史；倒排索引**不缓存**、每次由 worker 整体重算再 `mergeDecodedPages` union。新增 `cache.ts`/`merge.ts` + vitest（cache 用 fake-indexeddb、merge 纯函数）。
- [x] **API 层给分页接口补 transform** — `api/services/main/index.ts` 为 `list_page_bin/{md5}` 加 gzip→ArrayBuffer（OpenAPI 误标 `string[]`，实为二进制流）。
- [ ] **`KI-04` marker 图层整体重建** → 固定 layer id + props/`updateTriggers` 驱动，避免每次数据变化都 `new GenshinMarkerLayer`。改前读 `map-rendering-pipeline` 技能（陷阱 4）。
- [ ] **`KI-07` 状态混合缺「替换」语义** — 引入原始纹理透传开关/替换路径后再落地 active/inactive 变体。（红线 3：经 MarkerState 注册中心，勿手改 shader 常量）
- [ ] **`KI-09` 图标渲染任务不可取消** — `runRender` 增加 AbortController，复用 asyncStore 模式。
- [ ] **`KI-05` 渲染错误处理不对称** — 解码失败进 asyncStore 失败任务，渲染失败降级占位而非蓝屏。
- [ ] **`KI-08` 无 LOD/聚合** — 按 zoom 稀疏化（TDD-5 分片方案）。影响面大，宜单独设里程碑评估。

## 横切 / 基建

- [x] **KI-12 定夺：decode.ts 收敛为分页二进制（gzip JSON）解码**（第 6 轮完成）— 全量接口加载过慢，分页为性能/缓存正解；`decode.ts`/`decode.test.ts` 重写为 JSON 格式（position 字符串解析、`is_underground`），废弃未提交的 protobuf 重构；运行时契约 canary 同步更新。
- [x] **运行时测试体系 Phase 1：主要接口运行时单测**（第 5 轮完成）— `src/api/testing/`（env 解析 + node alova 客户端 `visitorLogin` 单飞 + `runtime.test.ts` 14 用例直连 dev 后端）。未配置真实后端时整体 skip；`cacheFor: null` 防 GET 内存缓存复用已消费 body。同时修掉基线 filter-basic/custom 4 个失败（mock 索引值改 numeric id）。发现 `list_page_bin/{md5}` 实测 gzip JSON（非 protobuf，见 KI-12）。Phase 2 候选：OpenAPI 契约回归（拉 spec diff 生成断言）、跨接口一致性扩展。
- [x] **侧边栏插件化落地** — `src/feature/sider-menus/plugin/`（`defineSiderItem` / 响应式注册中心 `registry.ts` / builtin filter·track·locale·setting），宿主 `sider-menus/index.vue` 按注册表动态渲染按钮与拓展面板，替代 `genshin-map/components/sider-toolbar` 硬编码+slot 方案。二开：`registerSiderItem` 注册一份 manifest（icon/name/layout/order/panel）。`registry.ts` 为纯逻辑，可作为 vitest 首测对象之一（配合 `KI-03`）。
- [x] **引入 vitest 最小测试闭环**（第 3 轮完成，命中 `KI-03` → [x]）：`vitest.config.ts`（node 环境）+ `pnpm test`/`test:watch`，`precommit`=lint+type+test；抽出纯模块 `decodeMarkerList`（`decode.ts`）、`atlas-layout.ts`，覆盖 decode(2)/atlas-layout(8)/filter-basic(5)/filter-search(4)/filter-custom(5)/smoke(1)=25 tests。`AGENTS.md`/`map-rendering-pipeline` 技能已补闸门与可测缝隙。后续可扩：**filter store Pinia 集成、`sider-menus/plugin/registry`、SFC 薄接线层（可选 Step 5，@vue/test-utils+jsdom）**。
- [ ] **插件化架构跟进** — 图层系统已方向化（commit 7a6da4a）；核对 proposal/1、2 与红线 3/10 是否一致，确定 MarkerState 注册中心与 store 注册中心接口。
- [ ] **补 TDD-4/9 设计占位** — `tdds/4-marker-linkage.md`（点位关联）、`tdds/9-overlay-layers.md`（分层层级）目前为 TODO 占位，排期时先补粗粒度设计。

## 收尾检查（每轮退出前对照）

- [ ] `pnpm check:type` + `pnpm lint` 通过
- [ ] 涉及页面/构建 → `pnpm build` + 受影响开发页冒烟
- [ ] 命中/修复的 `KI-xx` 已更新 `.agent/memory/known-issues.md`
- [ ] 本轮已追加 `ROUNDS.md`，`STATUS.md` 已反映最新进度