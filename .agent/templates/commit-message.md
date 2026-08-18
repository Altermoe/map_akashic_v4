# 模板：commit message

## 标准格式

```
<type>(<scope>): <emoji> <中文描述>

<可选：body，空行分隔，多行用 | 或换行>

<可选：footer，如 link: #123 / closed: #456>
```

## type / emoji 速查

| type | emoji | 适用 |
| --- | --- | --- |
| feat | ✨ :sparkles: | 新功能 |
| fix | 🐛 :bug: | 缺陷修复 |
| docs | 📝 :memo: | 文档 |
| style | 💄 :lipstick: | 格式/样式 |
| refactor | ♻️ :recycle: | 重构（无行为变化） |
| perf | ⚡ :zap: | 性能 |
| test | ✅ :white_check_mark: | 测试 |
| build | 💚 :green_heart: | 构建 |
| ci | 🚀 :rocket: | CI |
| revert | ⏪ :rewind: | 回退 |
| chore | 🔥 :fire: | 杂项 |
| deps | 📦 :package: | 依赖 |
| init | 🎉 :tada: | 初始化 |

## 示例

```
feat(filter): ✨ 新增物品筛选反查索引，降低筛选耗时

通过 itemMarkerIndex 将筛选从 O(N*M) 降为 O(M)，
并接入 asyncStore 提供进度与取消能力。

link: #31
```

```
fix(marker-layer): 🐛 修复图标图集未就绪时占位图层不显示的问题
```

## 规则要点

1. header ≤ 72 字符；subject 中文（专有名词除外）；中英 / 中数混排保留半角空格。
2. scope 用 src/ 子目录名（stores、genshin-map、map-filter…），可省略。
3. 破坏性变更在 body 中用 BREAKING CHANGE: 注明。
4. 提交前自查：pnpm lint + pnpm check:type（lint-staged 也会强制）。
