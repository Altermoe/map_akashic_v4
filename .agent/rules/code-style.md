# 规则：代码风格与质量门禁

> 适用：所有进入本仓库的代码改动。每条规则附带检查手段，无法通过检查的改动视为未完成。

## 1. 格式化（oxfmt，save 时自动执行）

- 配置见 [`.oxfmtrc.json`](../../.oxfmtrc.json)：`semi: false`、`singleQuote: true`、`trailingComma: all`、`endOfLine: lf`。
- VS Code 已配置 oxc 插件 `formatOnSave` + `source.format.oxc`；**不要引入 prettier/eslint 的格式化行为**，两者会互相打架。
- **检查**：`pnpm fmt`（dry-run 差异为 0）。

## 2. 静态检查（oxlint）

- 配置见 [`.oxlintrc.json`](../../.oxlintrc.json)：启用 typescript / vue / import / jsdoc / promise / node 等插件。
- 已忽略的生成文件（勿手改、勿移除忽略）：`src/api/**/apiDefinitions.ts`、`src/api/**/createApis.ts`、`src/api/**/globals.d.ts`。
- **检查**：`pnpm lint`，要求 0 error。现有 warning 仅允许出现在 `src/protobuf/index.mjs`（生成代码）。

## 3. 类型安全（TypeScript strict）

- **检查**：`pnpm check:type`（vue-tsc --noEmit）必须通过，这是提交前闸门。
- 禁止用 `any` 逃逸类型系统；确需宽类型时用 `unknown` + 收窄，或显式 `// oxlint-disable-next-line` 并附理由。
- 运行时校验统一用 zod（项目依赖 zod 4），schema 放 `src/shared/schemas/` 或模块内。
- 响应式性能：大数组/重型对象优先 `shallowRef` + `toRaw` 操作（参见 stores/marker、stores/icon 的既有模式），避免深响应式开销。

## 4. 命名与组件规范

- Vue SFC 组件文件名与标签统一 **PascalCase**（`icon-renderer.vue` 引用为 `<IconRenderer>`）。
- 目录名、store id、CSS class 用 kebab-case；变量/函数 camelCase；常量 UPPER_SNAKE_CASE。
- 组件一律 `<script setup lang="ts">`；`defineModel` / `defineProps` / `defineEmits` 显式声明类型。
- 新 UI 基础件放 `src/ui/`（g-* 前缀），跨功能复合件放 `src/components/`，业务件放 `src/feature/*/components/`。

## 5. 注释与文案语言

- 注释用**中文**，解释「为什么」而非「是什么」（本仓库既有注释即范例）。
- 用户可见文案必须走 i18n（`src/locales/{zh-CN,en,en-US}`），禁止硬编码；新文案至少补 zh-CN。
- 中文与英文、数字之间保留一个半角空格（与提交规范一致）。

## 6. 生成文件与自动产物（勿手改）

以下文件由工具生成，改动会被覆盖：

- `src/api/**/apiDefinitions.ts`、`src/api/**/createApis.ts`、`src/api/**/globals.d.ts`（alova VSCode 插件）
- `src/protobuf/index.mjs`、`src/protobuf/index.d.ts`（`pnpm proto:build`）
- `types/router.d.ts`、`types/auto-import.d.ts`（Vite 插件）
- `src/assets/*.png`（`pnpm svg:generate` 由 SVG 生成）

需要改协议/接口时改**源文件**（`src/protobuf/schema/*.proto`、OpenAPI 源），再跑对应生成命令。

## 7. 提交前检查清单

1. `pnpm lint` 0 error
2. `pnpm check:type` 通过
3. 改动文件未被 oxfmt 改动（`pnpm fmt` 无差异）
4. 未触碰生成文件、未提交 `envs/.env.*.local` / `dist` / 日志
5. 提交信息符合 [git-workflow.md](git-workflow.md)
