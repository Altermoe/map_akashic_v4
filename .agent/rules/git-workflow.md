# 规则：Git 提交工作流

## 1. 提交信息格式（硬性）

采用 czg emoji 规范（`commitlint.config.js` + `.trae/rules/git-commit-message.md` 双重约束）：

```
type(scope): <emoji> 中文描述
```

示例：`refactor(auth): ♻️ 替换原有登录接口为访客登录接口`

| 约束 | 值 |
| --- | --- |
| type 枚举 | `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `revert` `chore` `deps` `init`（小写） |
| type→emoji 映射 | feat:sparkles fix:bug docs:memo style:lipstick refactor:recycle perf:zap test:white_check_mark build:green_heart ci:rocket revert:rewind chore:fire deps:package init:tada |
| scope | 取 `src/` 子目录名（如 `map-filter`、`stores`、`genshin-map`），可省略 |
| 描述语言 | 中文（专有名词除外），中英/中数混排保留半角空格 |
| header 长度 | ≤ 72 字符 |
| body / footer | 需要时以空行分隔，footer 可带 `link:` / `closed:` 前缀关联 issue |

## 2. 提交流程

1. 自查改动（`pnpm lint` + `pnpm check:type`）。
2. `git add` 相关文件（只 add 本任务相关，禁止 `git add -A` 夹带无关改动）。
3. 提交：优先 `pnpm cz` 交互式生成；手写时严格按上表。
4. lint-staged 会自动执行 `check:type`（vue/js/ts 文件）与 `lint:fix`——若被拦截，修复后重提。
5. 一个提交只做一件事：feature / fix / refactor / docs 分开提交，禁止混合。

## 3. 分支与合入

- 当前项目在 `main` 单主线开发（无 release 分支）。
- 小改动直接提交 main；涉及多文件重构/新功能时先小步提交，保持每个提交可独立 review。
- 推送前 `git status` 确认无未跟踪敏感文件（`envs/.env.*.local` 等）。

## 4. 反模式（禁止）

- `fix` 提交里夹带格式化/重构 —— 分开或用 `style` / `refactor` 类型。
- 提交信息用英文缩写或无类型（如 `update code`）。
- 直接 `git commit -m` 绕过 lint-staged 又不自查。
- 提交生成文件的手改结果（见 code-style.md 第 6 节）。
