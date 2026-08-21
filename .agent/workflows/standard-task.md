# 工作流：标准任务闭环

> 适用：一切编码任务。目标是「改前有依据、改后有验证、提交合规」。

## 流程

### 0. 前置（1-2 分钟）

- [ ] 读根 AGENTS.md（本会话未加载时）。
- [ ] 读 .agent/rules/architecture.md + .agent/rules/git-workflow.md。
- [ ] 读 .agent/progress/STATUS.md 三秒定位进度；查 .agent/progress/TODO.md，把本任务对应项标 [~]（不在清单先加一项）。
- [ ] 查 .agent/memory/known-issues.md 是否命中本任务。

### 1. 理解与定位

- [ ] 对照 tdds/ 与 src/feature 确认功能现状（已实现？占位？TODO？）。
- [ ] 找出最小改动面：涉及哪些 store / 图层 / 组件 / 协议字段。
- [ ] 用 git log 查看相关文件的历史提交，理解演进意图。

### 2. 计划

- [ ] 用任务清单（todo list）拆解 3-8 个小步，每步可独立验证。
- [ ] 标注风险点：位掩码 / 缓存 / worker 协议等（见 skills 的陷阱清单）。

### 3. 实现

- [ ] 小步修改，每步跑通类型检查再继续。
- [ ] 涉及渲染链路时加载 map-rendering-pipeline 技能。
- [ ] 新异步逻辑接入 asyncStore（进度 + 取消），新并发逻辑用 token + AbortController。

### 4. 验证（缺一不可）

- [ ] pnpm check:type 通过
- [ ] pnpm lint 0 error
- [ ] pnpm build 通过（涉及页面/构建产物时）
- [ ] pnpm dev 冒烟受影响页面（开发页：map-filter / marker-texture-render / worker-marker-state）
- [ ] 缓存类改动：清理 IndexedDB / OPFS 相关命名空间后再验证，避免假阳性

### 5. 提交

- [ ] 按 .agent/rules/git-workflow.md 拆分提交（一个提交一件事）。
- [ ] 提交信息用 czg 格式（模板见 .agent/templates/commit-message.md）。
- [ ] git status 确认无敏感 / 无关文件被纳入。

## 收尾

- 回写账本（development-progress 技能闭环）：ROUNDS.md 追加「本轮做了什么/验证/遗留」；TODO.md 勾完成、补下一步；STATUS.md 更新阶段/下一步。
- 修复了已知问题 → 更新 .agent/memory/known-issues.md（状态改为 fixed）。
- 踩了新坑 / 有新决策 → 记入 .agent/memory/。
- 大改动后跑一次 reviewer 角色自审。
