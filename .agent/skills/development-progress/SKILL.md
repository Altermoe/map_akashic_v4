---
name: development-progress
description: 开发进度追踪与「前-中-后」强制动作。通过 .agent/progress 账本让任意会话三秒定位当前进度，并强制每次开发任务：开发前读架构/查 TODO，开发中对照 TODO 小步推进，开发后验证并回写「本轮做了什么 + 后续 TODO」。
when-to-use: 任何动手改代码 / 做开发任务的会话开始前必读；或用户问「开发到哪一步 / 下一步做什么 / 继续上次的工作」；或会话中途发现要继续此前未完成的工作。
---

# 技能：开发进度与前-中-后强制动作

> 本技能让「开发进行到哪一步」**跨会话可迁移**，并给每次开发任务套一个**前-中-后**的强制动作闭环，避免空手入局、中途失焦、收尾不记账。

## 1. 核心心智模型

两条原则撑起整套机制：

1. **三秒定位**：任何时刻先读 `STATUS.md`，就能回答「现在在哪、最该做下一步什么」。状态即上下文，扫一眼即续上，不需要考古。
2. **前-中-后闭环**：每次开发任务强制走「开发前看 → 开发中按 TODO 做 → 开发后验证并回写」。**回写是闭环的落点**——只有写回账本，下一会话才能续上。

## 2. 记录目录（唯一事实来源）

```
.agent/progress/
├── README.md      # 账本约定（分工 / 铁律 / 规范）
├── STATUS.md      # 权威状态快照：阶段 / 当前任务 / 下一步 / 挂起 ——「三秒定位」
├── TODO.md        # 待办清册：按里程碑分块，前-中-后实时维护
├── ROUNDS.md      # 追加式轮次账本：每轮做了什么 / 验证 / 遗留
└── history/       # 轮次归档（ROUNDS 过长时迁旧段进来）
```

**三条铁律（保持轻量）**：
- `STATUS.md` 是唯一权威；`TODO.md`/`ROUNDS.md` 只作证据。改一处必同步另两处，别留第二份新鲜副本。
- 每份文件**单页可扫读**；超长就把旧段归档到 `history/`。
- 每条记录带**可定位指针**（文件路径 / `tdds/` 编号 / `KI-xx`），让下个会话点得穿。

## 3. 强制流程：每次开发任务

### 🟢 开发前（入局自检，1-2 分钟）

1. 读 `README.md`（若第一次）、`STATUS.md` —— 确认当前阶段与本任务归属；纯查询场景读到这即可回答。
2. 读 `TODO.md` —— 找到本任务对应那块，把它标为 `[~] 做中`；**若要做的不在清单，先加一项再动手**。这一步同时确认「不是已在做的事」，避免重复造轮子。
3. 按任务领域加载文档，至少含：`AGENTS.md` + `.agent/rules/architecture.md`（红线）；**涉及渲染链路加载 `map-rendering-pipeline` 技能**（陷阱清单改前必读）。
4. 查 `.agent/memory/known-issues.md` —— 命中 `KI-xx` 则在回复中引用该编号。

### 🟡 开发中（对照 TODO 小步推进）

1. 严格按 `TODO.md` **一小步一小步**做：每完成一步即更新标记（`[x]`）并把「下一个小步」标为 `[~]`，再做一次 `pnpm fmt` + `pnpm lint` + `pnpm check:type` 闸门。
2. 严守红线（`architecture.md`，尤其数据链路不得绕行、生成文件勿手改）。
3. 一步一提交，遵守 `git-workflow.md`（czg 格式、一个提交一件事）。
4. 中途发现新问题 / 新坑 / 耽搁点 → **先记一笔到 `TODO.md`**（防止丢失），收尾再正式落账。

### 🔴 开发后（收尾闭环，缺一不可）

1. **验证（按面取证，不全量铺开）**：
   - **必跑（修改完毕后）**：`pnpm fmt` + `pnpm lint` + `pnpm check:type`（格式化干净、0 error）。
   - 涉及页面/构建产物 → `pnpm build` + 受影响开发页冒烟（`src/pages/development/`）。
   - 涉及缓存（atlas/合批/数据）→ 清理对应 IndexedDB / OPFS 命名空间后再验证。
   - 逻辑改动 → 若已有单测（vitest）则跑相关测试；没有则先不硬补，留到 TODO。
2. **提交**：按 `git-workflow.md` 拆分提交。
3. **回写账本（闭环落点）**：
   - `ROUNDS.md` 追加一条：目标 / 本轮做了什么 / 验证 / 遗留。
   - `TODO.md` 勾掉完成项、补齐「下一条」，把 `[~]` 清掉。
   - `STATUS.md` 更新：阶段 / 当前任务 / 下一步 / 挂起反映最新。
4. **已知问题联动**：命中/修复 `KI-xx` → 更新 `memory/known-issues.md`（修复则标 `[x]` 并注明方式，不删历史）；新坑 / 新决策按既有 memory 规范落账。

## 4. 何时更新哪份（速查）

| 时机 | 动作 |
| --- | --- |
| 任务**开始** | `TODO.md` 对应项标 `[~]`（不在清单就先加） |
| 每完成**小步** | `[x]` 勾上、next 标 `[~]`；跑 fmt / lint / check:type |
| 任务**收尾** | `validate → commit → ROUNDS/TODO/STATUS 三份同步` |
| 命中已知问题 | 回复引用 `KI-xx`；修复后回写 `memory/known-issues.md` |
| 纯查询「到哪了」 | 只读 `STATUS.md`（+ 必要时 TODO），**不回写** |

## 5. 常见坑（改坏过的 / 容易踩的）

- **只读不改**：问「到哪了」就开始改代码——纯查询不进入闭环，先答状态。
- **收尾不记账**：实现完提交就算完事，`STATUS` 已过期，下个会话又得考古。**记账是闭环的落点**。
- **三份不同步**：只更新了 `TODO` 没更新 `STATUS`，留下「新鲜副本」冲突。**改一处必同步另两处**。
- **清单失焦**：`TODO.md` 累积一堆过期项——收尾顺手清 `[x]`、把阻塞项写清原因与恢复条件，保「单页可扫读」。
- **重复造轮子**：想做的功能 `tdds/` 或 `src/feature` 已存在占位/实现——开发前第 2 步就是为此。
- **验证过重**：无脑全量跑（build+全测试）拖慢节奏——按**改动面**取验证证据即可（见 deepseek-harness「run relevant checks locally」取舍）。

## 6. 验证方式

本技能纯文档、无代码验证面；落地自检如下：

1. 三份账本文件存在且 `STATUS.md` 可扫读（`git status` 确认已纳入跟踪）。
2. 文档链接各自存在且可点通：
   - `AGENTS.md` ↔ `.agent/progress/STATUS.md`
   - `.agent/rules/architecture.md` ↔ `map-rendering-pipeline` / `development-progress` 技能
   - `.agent/memory/known-issues.md` 编号在 `STATUS.md` / `TODO.md` 中引用一致（`KI-01`~`KI-10`）。
3. `skills/README.md` 已登记 `development-progress`。
4. 走一遍冒烟：模拟「问下一步」→ 读 `STATUS.md` 能直接给答案。

## 7. 相关文档

- 账本约定：`.agent/progress/README.md`
- 已知问题：`.agent/memory/known-issues.md`
- 红线 / 提交：`.agent/rules/architecture.md`、`.agent/rules/git-workflow.md`
- 任务闭环：`.agent/workflows/standard-task.md`
- 设计：`proposal/0-overview.md`、`tdds/`