# skills — 可复用技能

## 已收录技能

| 技能 | 触发场景 |
| --- | --- |
| [map-rendering-pipeline](map-rendering-pipeline/SKILL.md) | 点位/marker 渲染、图标 atlas、MixtureIconLayer、GLSL、渲染性能 |
| [development-progress](development-progress/SKILL.md) | 任何开发任务开始前；或询问「开发到哪一步 / 下一步做什么」 |

## 什么是 skill

Skill 是「任务匹配时加载的专项知识包」：一个 SKILL.md + 可选资源文件。与 rules（必须遵守）不同，skill 只在任务命中其领域时才加载，用于提供深度上下文。

## 目录结构

```
skills/
├── README.md                    # 本文件：格式约定
└── <skill-name>/
    ├── SKILL.md                 # 技能主体（必填）
    └── ...                      # 可选：参考代码、数据样例、图等资源
```

## SKILL.md 格式

```
---
name: <技能名，kebab-case>
description: <一句话说明技能覆盖的领域，供匹配用>
when-to-use: <触发条件：任务满足哪些特征时加载本技能>
---

# <标题>

## 核心概念 / 链路图
## 关键文件索引（带路径）
## 每环节细节
## 常见修改点与陷阱
## 验证方式
```

## 编写规范

1. 描述必须写清 **when-to-use** 的触发词，便于匹配（如「点位渲染」「shader」「atlas」「marker 图层」）。
2. 内容**具体到文件路径与函数名**；引用既有代码，不复述通用知识。
3. 包含「陷阱」章节：记录改坏过/容易改坏的点（位掩码顺序、UV 边界、IconLayer 内部变量等）。
4. 新技能先确认不是 rules 的重复：**规则性内容进 rules，知识性内容进 skills**。

## 例外：meta 技能

`development-progress` 属于 **meta 技能**：不同于领域技能只在命中时加载，它应在**任何开发任务**都套上前-中-后闭环，因为它管的是「进度账本」（`.agent/progress/`），是会话间的共享状态。`AGENTS.md` 的「开始干活前」已挂接它。
