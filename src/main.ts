import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { messages } from '@/locales'
import './api'
import 'virtual:uno.css'
import App from './App.vue'
import AppError from './AppError.vue'
import { router } from './router'
import { useDebugStore } from './stores'

// ── 共享 pinia 实例（主应用与蓝屏应用共用） ───────────────
const pinia = createPinia()

const i18n = createI18n<[I18nType.Message], I18nType.Locale>({
  legacy: false,
  locale: document.documentElement.lang || 'en',
  fallbackLocale: 'en',
  messages,
})

// ── 创建主应用 ──────────────────────────────────────────
const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(i18n)

// pinia 注册完成后获取 debugStore
const debugStore = useDebugStore(pinia)

let errorApp: ReturnType<typeof createApp> | null = null

debugStore.fatalError$.subscribe(() => {
  if (errorApp) return
  app.unmount()
  errorApp = createApp(AppError)
  errorApp.use(pinia)
  errorApp.mount('#app')
})

app.config.errorHandler = (err, _instance, _info) => {
  if (debugStore.fatalError) return // 已有 fatal 则不再重复上报
  debugStore.reportFatal(err, {
    title: '应用运行时错误',
    category: 'vue-runtime',
  })
}

app.mount('#app')

window.addEventListener('error', (event) => {
  if (debugStore.fatalError) return
  // 仅处理 window 级别的错误（忽略 img/script 等资源加载失败）
  if (event.target && event.target !== window) return
  debugStore.reportFatal(event.error ?? event.message, {
    title: '全局运行时错误',
    category: 'global',
  })
})

window.addEventListener('unhandledrejection', (event) => {
  if (debugStore.fatalError) return
  debugStore.reportFatal(event.reason, {
    title: '未处理的 Promise 拒绝',
    category: 'unhandled-promise',
  })
})
