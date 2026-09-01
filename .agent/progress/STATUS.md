# 开发状态 —— 权威快照（三秒定位我在哪）

> 唯一事实来源。本文件保持**单页可扫读**；`TODO.md`/`ROUNDS.md` 是它的补充证据。每轮收尾必须更新；阶段切换时重写。
> 上次更新：2026-09-01（第 5 轮）。历史见 `ROUNDS.md`。

## 当前阶段

**Phase 1（基石）收尾** —— 地图渲染 / 瓦片 / 点位解码 / 基础筛选已完成；
**Phase 2（用户系统/云端同步）刚起步**（TDD-6 地图存档等尚未落地）。
> 另有关联方向：图层系统插件化已开始重构（proposal/1、2；commit 7a6da4a）；**侧边栏插件化已落地**（`sider-menus/plugin`）；**vitest 测试闭环已接入**（`KI-03` → [x]）；**运行时测试体系 Phase 1 已落地**（`src/api/testing/`，第 5 轮）。

## 当前任务

- 无正在推进的单一实现任务。上一轮（第 5 轮）完成 **运行时测试体系 Phase 1**：`src/api/testing/`（env 解析 + node alova 客户端，visitorLogin 单飞登录直连 dev）实现主要接口运行时单测 14 例（auth/area/marker_doc/item_doc/icon_doc/item_type/icon/item/notice + 跨目录完整性），并修掉基线 filter-basic/custom 4 个失败。**运行时发现：`list_page_bin/{md5}` 实测为 gzip JSON（非 protobuf，见 KI-12）**。详见 `ROUNDS.md` 第 5 轮。

## 下一步（最该先做的事）

1. **定夺 KI-12（marker 分页 wire format）**：dev 后端 `list_page_bin/{md5}` 返回 gzip JSON，而工作区 decode.ts 按 protobuf 假设（未提交重构）；HEAD 提交（c5f0240）是 JSON 解码且与后端一致。决定格式后收敛 decode + 注释，跑 `src/api/testing/runtime.test.ts` canary 验证。
2. **运行时测试 Phase 2**：OpenAPI 契约回归（拉 `VITE_SERVICE_MAIN_OPENAPI_URL` spec diff 生成断言模板）、更多接口覆盖（icon_type/marker 分页 POST 查询待后端修 500/403 后补）。
3. 或从 `TODO.md` 任一 `[~]` / 优先级最高项继续——如 **`KI-04` marker 图层重建**（改前读 `map-rendering-pipeline` 技能）。

## 挂起 / 阻塞

- ⚠️ **第 5 轮误回退 3 个文件未提交改动，无法从 git 恢复**：`src/AppError.vue`、`src/pages/development/map-filter.vue`、`src/feature/sider-menus/item-filter/index.vue`（约 4/12/35 行，内容未知，需 owner 确认）。`decode.ts`/`decode.test.ts`/`index.ts` 的未提交 protobuf 重构已从会话读取完整恢复。
- 无硬阻塞。`KI-04～KI-09` 为优化/稳健项，不影响当前推进。

## 关键指针

- 设计：`proposal/0-overview.md`（阶段规划）、`proposal/1-plugin-architecture.md`、`proposal/2-marker-state-plugin.md`、`tdds/`（TDD-1/2/3/5/6/7 有实质内容；**TDD-4/8/9 仍为 TODO 占位**）。
- 待办清册：`TODO.md`；轮次账本：`ROUNDS.md`（本轮细节）。
- 已知问题：`.agent/memory/known-issues.md`（KI-01·03·11 已修，**KI-12 marker 分页格式漂移（open）**，其余 open）。
- 运行时测试：`src/api/testing/`（`runtime.test.ts` 14 例直连 dev，未配置真实后端时整体 skip；`pnpm test` 全量含之）。
- 约束：`.agent/rules/architecture.md`（红线）、`.agent/rules/git-workflow.md`（提交）。
