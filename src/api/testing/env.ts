import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 运行时测试专用环境加载。
 *
 * 浏览器端走 `import.meta.env`（Vite 注入 + envDir=envs），但 vitest.config.ts 刻意
 * 不拉入 Vite 环境校验（见 vitest.config.ts 头注释），node 测试里没有可靠的
 * `import.meta.env` 注入。因此这里直接按 vite `loadEnv('development')` 的优先级
 * 解析 `envs/` 下的 .env 文件（.env < .env.local < .env.development < .env.development.local），
 * 不依赖 Vite 运行时。
 *
 * 关键换算：开发模式下 `VITE_SERVICE_MAIN_URL=/api-main` 是 vite dev 代理前缀，
 * 真实后端在 `VITE_SERVICE_MAIN_PROXY`（proxy target，代理会把 /api-main 前缀 rewrite 掉）。
 * node 直连必须用 proxy target 作为 baseURL，不能用相对路径。
 */

const ENVS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../envs')

const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local']

const parseEnvFile = (file: string): Record<string, string> => {
  const out: Record<string, string> = {}
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    return out
  }
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s#]+))/)
    if (!m) continue
    out[m[1]] = (m[2] ?? m[3] ?? m[4] ?? '').trim()
  }
  return out
}

const loadDevEnv = (): Record<string, string> =>
  ENV_FILES.reduce((acc, name) => ({ ...acc, ...parseEnvFile(resolve(ENVS_DIR, name)) }), {})

export interface RuntimeTestEnv {
  /** 直连主服务 baseURL（已解析 vite 代理），无有效配置时为 null */
  baseUrl: string | null
  /** Basic 认证 user:pass（visitorLogin 用） */
  basicAuth: string
  /** 是否配置了真实可测后端（false 时运行时测试整体 skip） */
  configured: boolean
}

export const runtimeTestEnv: RuntimeTestEnv = (() => {
  const env = loadDevEnv()
  const proxy = env.VITE_SERVICE_MAIN_PROXY?.trim()
  const rawUrl = env.VITE_SERVICE_MAIN_URL?.trim()
  // 优先 proxy target（node 直连）；否则接受绝对 URL；相对路径（vite 代理前缀）在 node 下不可直连
  const baseUrl = proxy || (rawUrl?.startsWith('http') ? rawUrl : null)
  const basicAuth = env.VITE_SERVICE_MAIN_BASIC_AUTH?.trim() ?? ''
  const isPlaceholder =
    !baseUrl ||
    baseUrl.includes('api.example.com') ||
    !basicAuth ||
    basicAuth.includes('username:password')
  return { baseUrl, basicAuth, configured: !isPlaceholder }
})()
