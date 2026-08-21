# 开发状态 —— 权威快照（三秒定位我在哪）

> 唯一事实来源。本文件保持**单页可扫读**；`TODO.md`/`ROUNDS.md` 是它的补充证据。每轮收尾必须更新；阶段切换时重写。
> 上次更新：2026-08-21（第 3 轮）。历史见 `ROUNDS.md`。

## 当前阶段

**Phase 1（基石）收尾** —— 地图渲染 / 瓦片 / 点位解码 / 基础筛选已完成；
**Phase 2（用户系统/云端同步）刚起步**（TDD-6 地图存档等尚未落地）。
> 另有关联方向：图层系统插件化已开始重构（proposal/1、2；commit 7a6da4a）；**侧边栏插件化已落地**（`sider-menus/plugin`）；**vitest 测试闭环已接入**（`KI-03` → [x]，见下）。

## 当前任务

- 无正在推进的单一实现任务。上一轮完成 **vitest 最小测试闭环接入**：`vitest.config.ts` + `pnpm test` 闸门，纯模块 seam 化（`decodeMarkerList` / `atlas-layout`），覆盖 decode/atlas-布局/filter-basic·search·custom 共 **25 tests**（详见 `ROUNDS.md` 第 3 轮）。

## 下一步（最该先做的事）

1. **测试覆盖扩展（续 `KI-03` 未覆盖面）**：优先补 **filter store 的 Pinia 集成测试**（`applyFilter`/`clearFilter` 全路径，含并发 token + AbortController 竞态，即多状态契约回归）；可加 `sider-menus/plugin/registry` 纯逻辑测试。详见 `TODO.md`「横切/基建」。
2. 或从 `TODO.md` 任一 `[~]` / 优先级最高项继续（无 `[~]` 时按下一条）——如 **`KI-04` marker 图层重建**（改前读 `map-rendering-pipeline` 技能，可能顺势抽 `composeLayers` planner 加回归）。

## 挂起 / 阻塞

- 无硬阻塞。`KI-04～KI-09` 为优化/稳健项，不影响当前推进。

## 关键指针

- 设计：`proposal/0-overview.md`（阶段规划）、`proposal/1-plugin-architecture.md`、`proposal/2-marker-state-plugin.md`、`tdds/`（TDD-1/2/3/5/6/7 有实质内容；**TDD-4/8/9 仍为 TODO 占位**）。
- 待办清册：`TODO.md`；轮次账本：`ROUNDS.md`（本轮细节）。
- 已知问题：`.agent/memory/known-issues.md`（KI-01·03·11 已修，其余 open）。
- 约束：`.agent/rules/architecture.md`（红线）、`.agent/rules/git-workflow.md`（提交）。