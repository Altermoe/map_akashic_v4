# AGENTS.md — 空荧酒馆 · 原神地图 V4

> 本文件是 AI 编码助手（Claude Code / Codex / Cursor / Gemini CLI 等）的**项目入口**。
> 只保留「启动即需」的事实；深度约定全部收敛在 [`.agent/`](.agent/) 目录，按需加载。

## 项目是什么

开源《原神》互动地图 Web 应用（V4），核心是「海量点位 + 多状态图标」的 Web 地图渲染与筛选。

- **当前阶段**：Phase 1（基石）收尾 —— 地图渲染、瓦片、点位解码、基础筛选已完成；Phase 2（用户系统/云端同步）刚起步。
- **设计文档**：[`proposal/0-overview.md`](proposal/0-overview.md)（提案）、[`tdds/`](tdds/)（TDD 设计，编号 1-10，部分仍为 TODO 占位）。

## 技术栈（版本以 package.json 为准）

Vue 3.5 · Vue Router 5（文件路由）· Pinia 3 · Vite 8 · **Deck.gl 9.3 + luma.gl 9.3**（WebGL2/WebGPU 渲染）· alova 3（HTTP）· protobufjs 8（二进制协议）· Dexie 4（IndexedDB）· zod 4（校验）· UnoCSS（样式）· vue-i18n 11 · rxjs 7 · Web Workers（解码/渲染）。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器，端口 **20928**（`--host` 暴露局域网） |
| `pnpm build` | 生产构建（**当前被 `src/pages/user/[id].vue` 空文件阻塞**，见 `.agent/memory/known-issues.md`） |
| `pnpm lint` / `pnpm lint:fix` | oxlint 检查 / 自动修复 |
| `pnpm check:type` | vue-tsc 类型检查（**改动后必须通过**） |
| `pnpm test` / `pnpm test:watch` | Vitest 单测（node 环境，覆盖纯逻辑/渲染 seam/筛选 store）；**改动涉及上述场景需跑相关用例** |
| `pnpm fmt` | oxfmt 格式化 |
| `pnpm precommit` | lint + typecheck + test（提交前闸门） |
| `pnpm cz` | czg 交互式提交（emoji 规范） |
| `pnpm proto:build` | 重新生成 protobuf 定义（改了 `src/protobuf/schema/*.proto` 后执行） |

**环境变量**：统一放在 `envs/`，由 `envs/schema.ts`（zod）在 Vite 启动时强制校验；本地私有配置用 `envs/.env.*.local`（已被 .gitignore 排除）。缺配置时先看 `envs/.env` 模板。

## 代码组织（src/）

| 目录 | 职责 |
| --- | --- |
| `src/feature` | 业务功能模块（如 `genshin-map`、`sider-menus`），每个模块自包含 components/elements/layers/stores 子结构 |
| `src/components` | 跨功能复用的复合组件（map-filter、draggable-panel、icon-renderer） |
| `src/ui` | 基础 UI 库（g-button / g-image / g-shape / g-icons / winui），PascalCase 命名 |
| `src/stores` | Pinia store；`src/stores/index.ts` 是唯一出口 |
| `src/api` | alova 服务层（main / config / assets / auth）+ OPFS 资源缓存 |
| `src/protobuf` | 协议定义（`schema/*.proto`）与生成代码（**生成文件勿手改**） |
| `src/shared` | 跨层共享类型 / 枚举 / 事件 |
| `src/pages` | 文件路由页面（`src/pages/development` 为开发调试页，生产构建会排除） |
| `src/database` | Dexie/IndexedDB 表定义 |
| `src/locales` | i18n（zh-CN / en / en-US），文案必须走 i18n |

## 硬性约束（违反即返工）

1. **提交规范**：czg emoji 格式 `type(scope): <emoji> 中文描述`，header ≤72 字符；scope 取 src 子目录名。详见 [`.agent/rules/git-workflow.md`](.agent/rules/git-workflow.md)。
2. **类型与风格**：TypeScript strict；改动后 `pnpm check:type` 与 `pnpm lint` 必须通过；格式化走 oxfmt（save 时自动）。详见 [`.agent/rules/code-style.md`](.agent/rules/code-style.md)。
3. **架构红线**：数据获取→Worker 解码→瘦身进 store→筛选→deck.gl 渲染的链路不得绕行；生成文件（`src/api/**/apiDefinitions.ts`、`src/protobuf/index.*`）勿手改。详见 [`.agent/rules/architecture.md`](.agent/rules/architecture.md)。
4. **不要提交**：`dist`、`node_modules`、`envs/.env.*.local`、日志文件。

## 开始干活前

1. 读本文档 + [`.agent/rules/architecture.md`](.agent/rules/architecture.md)（涉及渲染链路时再加读 [map-rendering-pipeline 技能](.agent/skills/map-rendering-pipeline/SKILL.md)）。
2. 读 [`.agent/progress/STATUS.md`](.agent/progress/STATUS.md) **三秒定位当前进度与下一步**；开发任务按 [development-progress 技能](.agent/skills/development-progress/SKILL.md) 走「开发前看 → 开发中按 TODO 做 → 开发后验证并回写账本」闭环。
3. 对照 [`tdds/`](tdds/) 与 [`src/feature`](src/feature) 确认功能现状，避免重复造轮子。
4. 检查 [`.agent/memory/known-issues.md`](.agent/memory/known-issues.md) 是否命中已知问题。
5. 按 [`.agent/workflows/standard-task.md`](.agent/workflows/standard-task.md) 走完「实现 → 验证 → 提交」闭环。
