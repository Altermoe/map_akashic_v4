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

## 2026-08-21 第 4 轮 — 点位加载改分页并发 + dexie 缓存

- **目标**：弃用全量 `listMarkersByBinary`，改 MD5 清单 + 分页并发加载，用 dexie 缓存二进制并支持过期/增量；倒排索引保持由 worker 整体重算。
- **本轮做了什么**：
  - 排查确认两个接口形态（`listMarkerBinaryMD5`=JSON 清单；`listPageMarkerByBinary`=OpenAPI 误标 `string[]` 的 gzip 二进制流）。
  - `api/services/main/index.ts`：为 `list_page_bin/{md5}` 加 `DecompressionStream(gzip)`→ArrayBuffer transform。
  - 新增 `src/stores/marker/cache.ts`（`buildMarkerCache` 注入 kv 表，manifest/page 读写、`MANIFEST_TTL`、`purgeStalePages`）、`merge.ts`（`mergeDecodedPages` 多分页 thin+倒排索引 union）。
  - 重写 `src/stores/marker/index.ts`：`useSerialRequest` 锚定清单，并发窗(4)拉缺失分页（单页重试一次后 partial 降级）、全部分页整体重解码、合并索引、`purgeStalePages`；暴露 `refresh()`。
  - 测试：`cache.test.ts`（fake-indexeddb 注入）、`merge.test.ts`。新增 +8 tests 全绿。
- **验证**：`pnpm check:type` 0 error；`pnpm lint` 0 error；`pnpm build` ✓（1.19s）；`pnpm test` 30 passed / 5 failed（**5 个失败为基线既有**：filter-basic/custom 各 2、decode「空列表」断言错误 1，均与本轮无关）。
- **遗留/下一步**：`fake-indexeddb` 已入 devDeps；`KI-04`(图层重建) 可并行；基线 5 个测试失败待修（含 decode.test「空列表返回空数组」阈值写错）。

## 2026-09-01 第 5 轮 — 运行时测试体系 Phase 1：主要接口运行时单测（visitorLogin 直连 dev）

- **目标**：将纯逻辑基线测试升级为「运行时结合测试」——Phase 1 先实现主要接口单测：通过 `visitorLogin` 访客登录直连 dev 后端，覆盖绝大多数只读接口（部分查询接口为 POST，按 OpenAPI spec 与源码调用点确定请求体），并在 node 环境解决 alova 可用性问题。
- **本轮做了什么**：
  - 新增 `src/api/testing/`：`env.ts`（按 vite loadEnv(development) 优先级解析 `envs/`，把 `/api-main` 代理前缀换算为 `VITE_SERVICE_MAIN_PROXY` 直连地址；占位符时 `configured=false` 整体 skip）、`client.ts`（node alova 实例：fetchAdapter + 无 statesHook 只走 `.send()`、`cacheFor: null` 避免 GET 内存缓存复用已消费 body、beforeRequest 注入 Bearer、visitorLogin 单飞 token 管理器 `VisitorTokenManager` + zod 校验）、`runtime.test.ts`（14 个用例：visitorLogin schema/单飞/复用、area、marker_doc 清单+全页 JSON 解码+id 唯一、item_doc、icon_doc、item_type、icon.listIcon、item.listItemIdByType 分页累积、notice、跨目录完整性）。
  - 修复基线 4 个失败（filter-basic/custom 各 2：c661dd3 后反查索引值为 numeric id，mock 仍用字符串 `'a'/'b'/'c'`）。
  - 运行时探针发现：dev 后端 `list_page_bin/{md5}` 实测为 **gzip JSON** MarkerVo[]（37 页 / 101,501 点位 / 0 重复），而 `list_markers` 全量为 protobuf（99,884）——与工作区 decode.ts 的 protobuf 假设及 `$$userConfigMap` 注释不符（记入 KI-12）。
- **验证**：`pnpm check:type` 0 error；`pnpm lint` 0 error；`pnpm test` 10 files / 50 tests 全绿（36 基线 + 14 运行时，运行时 ~70s 直连 dev）。跨目录完整性快照：iconRef=804/catalog=985/missing=2、itemRef=3847/catalog=4118/missing=16（历史悬挂引用，阈值内）。
- **遗留/下一步**：⚠️ 会话开始时工作区存在未提交的 protobuf 解码重构（decode.ts/test.ts/index.ts 注释），已从会话读取内容完整恢复；另有 `src/AppError.vue`、`src/pages/development/map-filter.vue`、`src/feature/sider-menus/item-filter/index.vue` 三文件的少量未提交改动（约 4/12/35 行）被 `git checkout` 覆盖且无法从 git 恢复，需 owner 确认是否缺失。后续：KI-12 定夺 marker 分页格式（JSON vs protobuf）；Phase 2 契约回归（OpenAPI diff + 断言模板）；Phase 3 AI 自主探索沙箱。

## 2026-09-01 第 6 轮 — KI-12 定夺：decode.ts 收敛为分页二进制（gzip JSON）解码

- **目标**：定夺 marker 分页 wire format（KI-12），decode.ts/测试只实现分页二进制接口解码（全量 protobuf 不作为前端解码链路——全量加载随游戏更新过慢，分页切片低频更新，性能/缓存更优）。
- **本轮做了什么**：
  - 实测复核两个二进制接口（经运行时客户端）：`list_markers`=gzip protobuf（99,884 条，protobufjs 解码 ✓）；`list_page_bin/{md5}`=gzip JSON（page0 2,991 条 ✓）；另探测 page0 全量样本：position 100% 为字符串 `"x,y"`，`extra.underground.is_underground` 为 snake_case。
  - 重写 `src/stores/marker/decode.ts`：JSON 解析（TextDecoder）+ `decodePosition` 字符串坐标解析（HEAD 版按数组解构 position 是潜在 bug）+ `is_underground` 读取 + 空 itemList `-1` fallback + 错误收集；doc 注明只面向分页格式（KI-12 定夺）。
  - 重写 `decode.test.ts`：golden 数据对齐真实格式（position 字符串、itemList camelCase、`is_underground`），3 用例（golden/空列表/非法 JSON）。
  - 同步：`runtime.test.ts` wire format 契约用例措辞（定夺而非不符）、`src/api/testing/README.md`、`known-issues.md` KI-12 → [x]。
- **验证**：`pnpm lint` 0 error；`pnpm check:type` 0 error；`pnpm test` 10 files / 50 tests 全绿（36 基线 + 14 运行时）。
- **遗留/下一步**：decode.ts 恢复为 JSON 后，原先未提交的 protobuf 重构（已由第 5 轮恢复的会话前工作区状态）正式废弃，本次一并提交收敛。后续：运行时测试 Phase 2（OpenAPI 契约回归）或 `KI-04` 图层重建。
