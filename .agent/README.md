# .agent — AI 编码基建目录

> 本目录集中存放本项目的 AI 编码协作约定（规则 / 角色 / 技能 / 工作流 / 模板 / 记忆）。
> 根目录 [`AGENTS.md`](../AGENTS.md) 只保留入口事实，**一切深度约定都在这里**，按需加载，避免污染上下文。

## 目录导航

| 子目录 | 内容 | 加载策略 |
| --- | --- | --- |
| [`rules/`](rules/) | 必须遵守的硬性规则：编码风格、架构红线、Git 提交规范 | **每次任务必读**（architecture + git-workflow） |
| [`memory/`](memory/) | 项目记忆：已知问题、决策记录、踩坑日志 | **动手前先查**，命中即引用 |
| [`skills/`](skills/) | 可复用技能（SKILL.md 格式）：地图渲染链路等专项知识 | 任务匹配时加载 |
| [`workflows/`](workflows/) | 标准执行流程：从任务到提交的闭环 | 每任务走一遍 |
| [`templates/`](templates/) | 可复用模板：提交信息、任务清单 | 按需套用 |
| [`agents/`](agents/) | 角色卡片（通用 frontmatter 格式）：实现者 / 审查者 / 渲染专项 | 需要专职/分工时激活 |

## 写作规范（维护本目录时遵守）

1. **Why-first**：每条规则先写「为什么」，再写「怎么做」——约束必须可辩护。
2. **具体到项目**：引用真实文件路径、命令、枚举值；禁止泛泛而谈的套话。
3. **可验证**：每条规则都应有对应的检查手段（lint / typecheck / build / 人工检查）。
4. **保持精简**：单一主题一个文件；根 AGENTS.md 与 .agent/README.md 只做索引，不做内容复读。
5. **中英混排**：正文中文，代码/命令/标识符英文；中文与英文、数字之间保留半角空格。

## DSH 集成（技能发现桥接）

DeepSeek Harness 的 skill-filesystem provider 从项目级根目录发现技能：
`<项目根>/.dsh/skills` 与 `<项目根>/.agents/skills`（**不会**扫描 `.agent/skills`）。

为让 `.agent/skills/` 保持唯一事实来源、同时被 DSH 识别，项目根维护一组符号链接桥接：

```text
.agents/skills/<skill-name> -> ../../.agent/skills/<skill-name>
```

**新增技能流程**：

1. 在 `.agent/skills/<name>/SKILL.md` 编写技能（frontmatter 必须含 `name` / `description` / `when-to-use`）；
2. 在 `.agents/skills/` 下创建同名符号链接指向它；
3. DSH（`watchFollowSymlinks` 默认开启）会自动把技能注入会话 skill catalog。

已在册技能：`map-rendering-pipeline`（2026-08-17 验证：provider=filesystem，skill 工具可完整加载）。

## 变更记录

- 2026-08-17：创建本目录与全部子基建（AGENTS.md 引导 + rules/agents/skills/workflows/templates/memory）。
- 2026-08-18：新增 DSH 技能发现桥接（.agents/skills 符号链接），项目级技能正式接入会话 skill catalog。
