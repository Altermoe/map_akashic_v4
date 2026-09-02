# 开发状态 —— 权威快照（三秒定位我在哪）

> 唯一事实来源。本文件保持**单页可扫读**；`TODO.md`/`ROUNDS.md` 是它的补充证据。每轮收尾必须更新；阶段切换时重写。
> 上次更新：2026-09-01（第 6 轮）。历史见 `ROUNDS.md`。

## 当前阶段

**Phase 1（基石）收尾** —— 地图渲染 / 瓦片 / 点位解码 / 基础筛选已完成；
**Phase 2（用户系统/云端同步）刚起步**（TDD-6 地图存档等尚未落地）。
> 另有关联方向：图层系统插件化已开始重构（proposal/1、2；commit 7a6da4a）；**侧边栏插件化已落地**（`sider-menus/plugin`）；**vitest 测试闭环已接入**（`KI-03` → [x]）；**运行时测试体系 Phase 1 已落地**（`src/api/testing/`，第 5 轮）；**KI-12 已定夺**（decode.ts 收敛为分页 gzip JSON 解码，第 6 轮）。

## 当前任务

- 无正在推进的单一实现任务。上一轮（第 6 轮）完成 **KI-12 定夺**：全量接口加载过慢，分页是性能/缓存正解 → `decode.ts`/`decode.test.ts` 重写为分页二进制（gzip JSON）解码（position 字符串 `"x,y"` 解析、`extra.underground.is_underground`），废弃未提交的 protobuf 重构；`runtime.test.ts` wire format 契约用例同步更新。详见 `ROUNDS.md` 第 6 轮。

> 第 7 轮（本轮）**已完成**：`development` 新增子页 `/development/area-icon-tint`「区域图标着色」——`import.meta.glob` 收集 `src/assets/area` 22 张图标按网格渲染，右侧 `OklchColorPicker` + css `background-image`/`mask` 实时洗色。详见 `ROUNDS.md` 第 7 轮。

## 下一步（最该先做的事）

1. **运行时测试 Phase 2**：OpenAPI 契约回归（拉 `VITE_SERVICE_MAIN_OPENAPI_URL` spec diff 生成断言模板）、更多接口覆盖（icon_type/marker 分页 POST 查询待后端修 500/403 后补）。
2. 或从 `TODO.md` 任一 `[~]` / 优先级最高项继续——如 **`KI-04` marker 图层重建**（改前读 `map-rendering-pipeline` 技能）。

## 挂起 / 阻塞

- ⚠️ **第 5 轮误回退 3 个文件未提交改动，无法从 git 恢复**：`src/AppError.vue`、`src/pages/development/map-filter.vue`、`src/feature/sider-menus/item-filter/index.vue`（约 4/12/35 行，内容未知，需 owner 确认）。其余未提交的 protobuf 重构已在第 6 轮定夺废弃（decode 收敛 JSON，随第 6 轮提交）。
- 无硬阻塞。`KI-04～KI-09` 为优化/稳健项，不影响当前推进。

## 关键指针

- 设计：`proposal/0-overview.md`（阶段规划）、`proposal/1-plugin-architecture.md`、`proposal/2-marker-state-plugin.md`、`tdds/`（TDD-1/2/3/5/6/7 有实质内容；**TDD-4/8/9 仍为 TODO 占位**）。
- 待办清册：`TODO.md`；轮次账本：`ROUNDS.md`（本轮细节）。
- 已知问题：`.agent/memory/known-issues.md`（KI-01·03·11·12 已修，其余 open）。
- 运行时测试：`src/api/testing/`（`runtime.test.ts` 14 例直连 dev，未配置真实后端时整体 skip；`pnpm test` 全量含之）。
- 约束：`.agent/rules/architecture.md`（红线）、`.agent/rules/git-workflow.md`（提交）。
