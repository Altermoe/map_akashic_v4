# 空荧酒馆 - 原神地图 V4

## 项目运行手册

### 前置要求

#### 1. 环境依赖

- **Node.js**: 建议使用 LTS 版本（20.x 或更高）
- **pnpm**: 版本 `10.11.0`（项目指定包管理器）

```bash
# 安装 pnpm（如未安装）
npm install -g pnpm@10.11.0
```

#### 2. 环境变量配置

项目依赖后端服务提供 tile 资源和数据接口，需要配置以下环境变量。

**方式一：获取 `.env.local` 文件（推荐）**

联系开发组获取已配置好的 `envs/.env.local` 文件，直接放入 `envs/` 目录即可。

**方式二：自行配置**

复制 `envs/.env` 模板文件为 `.env.local`，并填写实际的服务地址：

```bash
cp envs/.env envs/.env.local
```

编辑 `envs/.env.local`，填写必填配置项：

```env
# 主服务（必填）
VITE_SERVICE_MAIN_URL = 'https://your-main-api.com'
VITE_SERVICE_MAIN_BASIC_AUTH = 'username:password'

# 配置服务（必填）
VITE_SERVICE_CONFIG_URL = 'https://your-config-api.com'

# 资源服务（必填，提供 tile 瓦片资源）
VITE_SERVICE_RESOURCE_URL = 'https://your-resource-api.com'
```

**必填配置项说明**：

| 配置项                         | 说明                                                |
| ------------------------------ | --------------------------------------------------- |
| `VITE_SERVICE_MAIN_URL`        | 主 API 服务地址，提供地图标记数据等核心接口         |
| `VITE_SERVICE_MAIN_BASIC_AUTH` | 主服务的 Basic 认证凭证，格式为 `username:password` |
| `VITE_SERVICE_CONFIG_URL`      | 配置服务地址，提供应用配置信息                      |
| `VITE_SERVICE_RESOURCE_URL`    | 资源服务地址，提供地图瓦片（tile）资源              |

**可选开发配置**（用于本地代理调试）：

```env
# 主服务代理（开发环境）
VITE_SERVICE_MAIN_PROXY = ''

# 配置服务代理（开发环境）
VITE_SERVICE_CONFIG_PROXY = ''

# 资源服务代理（开发环境）
VITE_SERVICE_RESOURCE_PROXY = ''
```

### 启动要求

#### 安装依赖

```bash
pnpm install
```

#### 开发环境启动

```bash
pnpm dev
```

开发服务器默认运行在 `http://localhost:20928`（端口 20928 取自原神上线日期 2020-09-28）。

#### 生产构建

```bash
pnpm build
```

构建产物将输出到 `dist/` 目录。

### 常用命令

| 命令                | 说明                            |
| ------------------- | ------------------------------- |
| `pnpm dev`          | 启动开发服务器                  |
| `pnpm build`        | 生产构建                        |
| `pnpm lint`         | 代码检查（oxlint）              |
| `pnpm lint:fix`     | 代码检查并自动修复              |
| `pnpm fmt`          | 代码格式化（oxfmt）             |
| `pnpm check:type`   | TypeScript 类型检查             |
| `pnpm precommit`    | 提交前检查（lint + type check） |
| `pnpm proto:build`  | 构建 protobuf 定义文件          |
| `pnpm svg:generate` | 生成 SVG 对应的 PNG 资源        |

### 技术栈

- **框架**: Vue 3 + Vue Router 5
- **状态管理**: Pinia 3
- **构建工具**: Vite 8
- **地图渲染**: Deck.gl 9
- **HTTP 客户端**: Alova 3
- **样式**: UnoCSS
- **语言**: TypeScript 5
