<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDebugStore } from '@/stores'

const debugStore = useDebugStore()
const fatal = computed(() => debugStore.fatalError)

const copyState = ref<'idle' | 'success' | 'failed'>('idle')

/** 格式化完整错误信息（用于复制 / 导出） */
function formatErrorText(): string {
  if (!fatal.value) return ''
  const lines: string[] = []
  lines.push(`标题: ${fatal.value.title}`)
  lines.push(`分类: ${fatal.value.category}`)
  lines.push(`时间: ${new Date(fatal.value.timestamp).toLocaleString()}`)
  lines.push(`ID: ${fatal.value.id}`)
  lines.push(`消息: ${fatal.value.message}`)
  if (fatal.value.error?.stack) {
    lines.push('')
    lines.push('堆栈:')
    lines.push(fatal.value.error.stack)
  }
  return lines.join('\n')
}

/** 复制错误信息到剪贴板 */
async function copyError() {
  copyState.value = 'idle'
  const text = formatErrorText()
  try {
    await navigator.clipboard.writeText(text)
    copyState.value = 'success'
  } catch {
    // fallback: 创建临时 textarea 并选中
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      copyState.value = 'success'
    } catch {
      copyState.value = 'failed'
    }
  }
  setTimeout(() => (copyState.value = 'idle'), 2500)
}

/** 导出全部日志为 JSON 文件 */
function exportLogs() {
  const json = debugStore.exportLogs()
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `app-logs-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 刷新页面 */
function reload() {
  location.reload()
}
</script>

<template>
  <div class="bsod">
    <div class="bsod-content">
      <div class="bsod-face">{{ ':(' }}</div>

      <h1 class="bsod-title">你的应用遇到了问题，需要重新启动。</h1>

      <p class="bsod-desc">
        我们正在收集一些错误信息，之后你可以重新启动应用。
        <br />
        <br />
        <strong class="bsod-error-title">{{ fatal?.title }}</strong>
        <br />
        错误分类: {{ fatal?.category }}
        <br />
        {{ fatal?.message }}
      </p>

      <pre v-if="fatal?.error?.stack" class="bsod-stack">{{ fatal.error.stack }}</pre>

      <div class="bsod-actions">
        <button class="bsod-btn" @click="copyError">
          {{
            copyState === 'success'
              ? '已复制 ✓'
              : copyState === 'failed'
                ? '复制失败'
                : '复制错误信息'
          }}
        </button>
        <button class="bsod-btn" @click="exportLogs">导出日志</button>
        <button class="bsod-btn bsod-btn-primary" @click="reload">刷新页面</button>
      </div>

      <p class="bsod-footer">停止代码: {{ fatal?.id?.slice(0, 8).toUpperCase() }}</p>
    </div>
  </div>
</template>

<style scoped>
.bsod {
  position: fixed;
  inset: 0;
  background: #0078d7;
  color: #fff;
  font-family:
    'Segoe UI',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    Roboto,
    'Helvetica Neue',
    Arial,
    sans-serif;
  display: grid;
  place-content: center;
  padding: 48px;
  z-index: 9999;
  overflow: auto;
}

.bsod-content {
  max-width: 720px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.bsod-face {
  font-size: 120px;
  font-weight: 100;
  line-height: 1;
  margin: 0;
  font-family: 'Segoe UI Symbol', 'Segoe UI', sans-serif;
}

.bsod-title {
  font-size: 28px;
  font-weight: 300;
  line-height: 1.3;
  margin: 0;
}

.bsod-desc {
  font-size: 16px;
  line-height: 1.6;
  margin: 0;
  opacity: 0.95;
}

.bsod-error-title {
  font-size: 18px;
  font-weight: 600;
}

.bsod-stack {
  margin: 0;
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.bsod-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.bsod-btn {
  padding: 10px 20px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.bsod-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.6);
}

.bsod-btn:active {
  background: rgba(255, 255, 255, 0.25);
}

.bsod-btn-primary {
  background: #fff;
  color: #0078d7;
  border-color: #fff;
  font-weight: 600;
}

.bsod-btn-primary:hover {
  background: #f0f0f0;
  border-color: #f0f0f0;
}

.bsod-footer {
  margin: 0;
  margin-top: 16px;
  font-size: 14px;
  opacity: 0.8;
  font-family: 'Cascadia Code', Consolas, monospace;
}
</style>
