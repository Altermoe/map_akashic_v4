# memory：已知问题（Known Issues）

> 记录日期：2026-08-17。新增条目时保留此表头并追加编号；修复后标记 [x] 并注明修复方式。

## KI-01 生产构建失败：src/pages/user/[id].vue 为空文件

- **状态**：[x] fixed（2026-08-18：补全页面为 TODO 占位模板，pnpm build 恢复通过 ✓ built in 1.25s）
- **影响**：pnpm build 直接失败（SFC 解析：At least one <template> or <script> is required），阻塞所有生产发布。
- **背景**：提交 e2b69e7 添加用户中心路由时留下的 0 字节占位；vite.config.ts 只排除了 development.vue，未排除它。
- **修复方式**：用户提交 72ffa7c 为 [id].vue 补充了最小 SFC 模板。

## KI-02 lint 警告：生成代码 src/protobuf/index.mjs 的 jsdoc 标签

- **状态**：[ ] open（可接受）
- **影响**：pnpm lint 报 14 条 warning（@constructor 应为 @class），不影响通过。
- **建议**：属 protobufjs 生成模板问题，勿手改生成文件；若需清零，可在生成脚本后处理或调整 lint 忽略。

## KI-03 零测试覆盖

- **状态**：[ ] open
- **影响**：decode.worker、atlas 布局计算、UV 数学、filter-basic 等纯逻辑无单测，重构无回归兜底。
- **建议**：引入 vitest，优先覆盖 decode.worker（golden data）、calculateLayout、filter-basic。

## KI-04 marker 图层整体重建（性能风险）

- **状态**：[ ] open
- **影响**：elements/marker-layer.vue 每次数据/图集变化都 new GenshinMarkerLayer 替换 layers[index]，丢失 deck.gl 图层 diffing（attribute 缓冲全量重建）；数据量增大或筛选高频变化时卡顿风险高。
- **建议**：固定 layer id + props 驱动更新；updateTriggers 只更新 mask/position；图集 URL 变化才重建。

## KI-05 渲染错误处理不对称

- **状态**：[ ] open
- **影响**：点位解码失败静默置空（地图空白无提示）；图标渲染失败会抛到全局 unhandledrejection → 蓝屏（AppError）。同链路两种极端体验。
- **建议**：解码失败接入 asyncStore 失败任务 + 地图错误态；渲染失败降级为占位图层而非蓝屏。

## KI-06 MixtureIconLayer 强耦合 deck.gl 内部实现

- **状态**：[ ] open
- **影响**：vs 注入依赖 iconSize / instanceScale / instanceIconFrames / icon.iconsTextureDim 等 IconLayer 内部变量，deck.gl 9 → 10 升级几乎必然破裂。
- **建议**：升级前先验证 marker 渲染；中长期收敛为带注释的适配层或自维护 shader。

## KI-07 状态混合缺少「替换」语义

- **状态**：[ ] open
- **影响**：fragment shader 无条件叠加原始图标，无法表达「点位已标记 → 换成 active 图标」（TDD-7 要求），只能叠加不能替换。
- **建议**：引入原始纹理透传开关/替换路径后再落地 active/inactive 变体。

## KI-08 无 LOD / 聚合，全量数据全量绘制

- **状态**：[ ] open
- **影响**：listMarkersByBinary 全量拉取解码，getSize 固定 40，无 zoom 驱动的稀疏化；点位规模大时内存与 attribute 上传压力高（TDD-5 分片方案未落地）。
- **建议**：按 zoom 聚合/稀疏化；数据侧跟进分片压缩。

## KI-09 icon 渲染任务不可取消

- **状态**：[ ] open
- **影响**：runRender 无 AbortController，图标列表频繁变化时可能并发排队多份 WebGPU 渲染。
- **建议**：为 runRender 增加取消令牌，复用 asyncStore 模式。

## KI-10 生产构建会重生成 types/router.d.ts（剔除 development 路由）

- **状态**：[ ] open（无害噪音）
- **影响**：pnpm build 以生产模式运行 VueRouter 插件，重写 types/router.d.ts（移除 /development 路由），导致构建后工作区出现该文件改动；下次 pnpm dev 会再按 dev 模式重生成回来。
- **建议**：构建后 git checkout types/router.d.ts；若该生成文件不再需要跟踪，可移出版本控制。
