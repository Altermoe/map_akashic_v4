import { createAlova } from 'alova'
import fetchAdapter from 'alova/fetch'
import { loginResponseSchema, type LoginResponse } from '../services/auth/schema'
import { createApis } from '../services/main/createApis'
import { runtimeTestEnv } from './env'

/**
 * node 运行时测试客户端 —— 复刻浏览器端主服务实例的认证/响应语义，但不依赖任何浏览器能力：
 *
 * - 独立 alova 实例（fetchAdapter + node 全局 fetch，无 statesHook，只走 method.send()）；
 * - beforeRequest 与浏览器端一致：无有效 token 时先 `visitorLogin`（OAuth2 client_credentials）
 *   拿访客 token，之后所有请求带 Bearer；
 * - token 单飞（single-flight）：并发请求共享同一次登录，登录次数可断言（tokenManager.loginCount）；
 * - responded 与浏览器端一致：非 2xx 抛错；JSON 且 `error` 为真抛错；二进制原样返回 Response；
 * - API 面复用生成的 createApis 代理（apiDefinitions 是唯一契约，勿手写 URL）。
 *
 * ⚠️ 与浏览器端的差异：浏览器 baseURL 是 vite 代理前缀 `/api-main`，node 直连用
 * `VITE_SERVICE_MAIN_PROXY` 解析出的真实后端地址（见 env.ts）。
 */

const DELAY_MS = 30_000 // 与 src/stores/user 的 token 提前刷新量保持一致

const toUpperFirst = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase())

export class VisitorTokenManager {
  private cached: { token: LoginResponse; expiresAt: number } | null = null
  private inflight: Promise<LoginResponse> | null = null
  /** 已发起的 visitorLogin 次数（单飞断言用） */
  loginCount = 0

  constructor(private readonly login: () => Promise<unknown>) {}

  get(): Promise<LoginResponse> {
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return Promise.resolve(this.cached.token)
    }
    if (!this.inflight) {
      this.loginCount++
      this.inflight = this.doLogin()
      void this.inflight
        .finally(() => {
          this.inflight = null
        })
        .catch(() => {})
    }
    return this.inflight
  }

  invalidate(): void {
    this.cached = null
  }

  private async doLogin(): Promise<LoginResponse> {
    const raw = await this.login()
    const parsed = loginResponseSchema.safeParse(raw)
    if (!parsed.success) {
      throw new Error(`visitorLogin 响应不符合 loginResponseSchema: ${parsed.error.message}`)
    }
    this.cached = {
      token: parsed.data,
      expiresAt: Date.now() + parsed.data.expires_in * 1000 - DELAY_MS,
    }
    return parsed.data
  }
}

/** 直连主服务的 alova 实例（node） */
export const instance = createAlova({
  baseURL: runtimeTestEnv.baseUrl ?? 'https://api.example.com',
  timeout: 15_000,
  // 运行时测试禁用缓存：GET 默认内存缓存会让二进制 Response 二次命中时 body 已被消费
  // （bodyUsed=true / state=closed），导致 gunzip 空流；测试需要每次真实请求。
  cacheFor: null,
  requestAdapter: fetchAdapter(),
  beforeRequest: async (method) => {
    // visitorLogin 方法自带 Basic 头，跳过 Bearer 注入
    if (method.config.headers?.Authorization) return
    const token = await tokenManager.get()
    method.config.headers['Authorization'] =
      `${toUpperFirst(token.token_type)} ${token.access_token}`
  },
  responded: async (res) => {
    const clone = res.clone()
    if (!clone.ok) {
      throw new Error(clone.statusText || `status ${clone.status}`)
    }
    const contentType = clone.headers.get('content-type')
    if (!contentType?.startsWith('application/json')) {
      // 二进制（gzip 分页/目录）原样返回 Response，由测试自行解压
      return res
    }
    const json = (await clone.json()) as { error?: unknown; message?: string }
    if (json.error) {
      throw new Error(json.message || `请求失败: ${clone.status}`)
    }
    return json
  },
})

const loginMethod = instance.Post(
  '/oauth/token',
  {},
  {
    params: { grant_type: 'client_credentials', scope: 'all' },
    headers: { Authorization: `Basic ${btoa(runtimeTestEnv.basicAuth)}` },
  },
)

/** 访客 token 单飞管理器（浏览器端等价物：createClientTokenAuthentication + useUserStore） */
export const tokenManager = new VisitorTokenManager(() => loginMethod.send())

/** 生成 API 面：与浏览器端同一份 apiDefinitions 契约，无额外 transform（二进制由测试处理） */
export const runtimeApis = createApis(instance, {})

/** 供测试快速取 R 包装里的 data */
export const unwrap = <T>(res: unknown): T => (res as { data: T }).data

/** gzip 二进制 → 文本（marker/item/icon 目录类接口的公共解码） */
export const gunzipText = async (res: Response): Promise<string> => {
  const ds = new DecompressionStream('gzip')
  const buffer = await new Response(res.body?.pipeThrough(ds)).arrayBuffer()
  return new TextDecoder().decode(buffer)
}
