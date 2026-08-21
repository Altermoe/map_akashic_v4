import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vitest 配置 —— 独立于 vite.config.ts，避免拉入 VueRouter/UnoCSS/svgToPng/env 强校验。
 *
 * 设计原则（WebGIS 无 DOM 应用）：
 * - 默认 `node` 环境：核心可测逻辑（解码、atlas 布局、筛选、store）都是纯 JS，
 *   跑在 node 里最快、零 DOM/webgl 依赖。绝大多数测试不应碰 jsdom。
 * - `@/` 别名与 vite.config.ts 保持一致。
 * - 个别 SFC「薄接线」测试走 jsdom（@vue/test-utils + stub deck），用 environmentMatchGlobs 点名启用，
 *   不必为全局装 webgl/jsdom 环境。
 */
export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}/`,
    },
  },
  test: {
    // 默认 node；SFC 接线测试逐个开启 jsdom
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx,mts,cts,js,jsx}'],
    testTimeout: 10_000,
    pool: 'forks',
  },
})
