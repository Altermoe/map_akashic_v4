# 开发状态 —— 权威快照（三秒定位我在哪）

> 唯一事实来源。本文件保持**单页可扫读**；`TODO.md`/`ROUNDS.md` 是它的补充证据。每轮收尾必须更新；阶段切换时重写。
> 上次更新：2026-08-21（第 1 轮）。历史见 `ROUNDS.md`。

## 当前阶段

**Phase 1（基石）收尾** —— 地图渲染 / 瓦片 / 点位解码 / 基础筛选已完成；
**Phase 2（用户系统/云端同步）刚起步**（TDD-6 地图存档等尚未落地）。
> 另有关联方向：图层系统插件化已开始重构（proposal/1、2；commit 7a6da4a）。

## 当前任务

- 无正在推进的单一实现任务（本轮为 AI Coding 基建：新增 development-progress 技能与进度账本）。

## 下一步（最该先做的事）

1. **引入 vitest 最小测试**，优先覆盖 `decode.worker`（golden data）、`calculateLayout`、`filter-basic` —— 命中 `KI-03` 零测试覆盖，且 vitest 依赖已入 `package.json`（commit ef54ce0）。详见 `TODO.md`「横切/基建」。
2. 或从 `TODO.md` 任一 `[~]` / 优先级最高项继续（无 `[~]` 时按下一条）。

## 挂起 / 阻塞

- 无硬阻塞。`KI-04～KI-09` 为优化/稳健项，不影响当前推进。

## 关键指针

- 设计：`proposal/0-overview.md`（阶段规划）、`proposal/1-plugin-architecture.md`、`proposal/2-marker-state-plugin.md`、`tdds/`（TDD-1/2/3/5/6/7 有实质内容；**TDD-4/8/9 仍为 TODO 占位**）。
- 待办清册：`TODO.md`；轮次账本：`ROUNDS.md`（本轮细节）。
- 已知问题：`.agent/memory/known-issues.md`（KI-01 已修，KI-02～KI-10 open）。
- 约束：`.agent/rules/architecture.md`（红线）、`.agent/rules/git-workflow.md`（提交）。