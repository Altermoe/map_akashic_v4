# 运行时测试（runtime testing）

> 通过 `visitorLogin` 以访客身份直连 dev 后端，对**主要接口**做运行时数据单测（Phase 1）。
> 配套账本：`ROUNDS.md` 第 5-6 轮、`known-issues.md` KI-12（已定夺：分页 JSON 为正式解码格式）。

## 文件

| 文件 | 职责 |
| --- | --- |
| `env.ts` | 按 vite `loadEnv('development')` 优先级解析 `envs/`；把 `/api-main` 代理前缀换算为 `VITE_SERVICE_MAIN_PROXY` 直连地址；占位符时 `configured=false` |
| `client.ts` | node alova 实例（fetchAdapter、无 statesHook、`cacheFor: null` 防 GET 内存缓存复用已消费 body）+ `VisitorTokenManager`（visitorLogin 单飞 + zod 校验）+ `createApis` 复用生成契约 |
| `runtime.test.ts` | 14 个用例：auth / area / marker_doc / item_doc / icon_doc / item_type / icon / item / notice + 跨目录完整性 |

## 运行

```bash
pnpm test                      # 全量（含运行时；未配置真实后端时整体 skip）
pnpm vitest run src/api/testing/runtime.test.ts   # 只跑运行时
```

## 关键事实（KI-12 定夺）

- dev 后端 `list_page_bin/{md5}` 实测为 **gzip JSON** MarkerVo[]（37 页 / 101,501 点位 / 0 重复）；
  `list_markers`（全量）才是 **protobuf**（99,884）。**定夺**：全量接口随游戏更新加载过慢，
  分页是性能/缓存更优选择 → `decode.ts` 只实现分页 JSON 解码，测试已固化该契约作为 canary——格式一变即红。
- 跨目录完整性基线（2026-09-01）：icon 悬挂 2（`[0,1]`）、item 悬挂 16，均在阈值内（≤5 / ≤25）。

## 注意

- 测试直连真实后端，请勿在无网络/非 dev 环境强跑；占位符 env 会自动 skip。
- node 端 alova 必须 `cacheFor: null`：GET 默认内存缓存会让二进制 Response 二次命中时
  body 已被消费（`bodyUsed=true` / `state=closed`），gunzip 空流报 Z_BUF_ERROR。
