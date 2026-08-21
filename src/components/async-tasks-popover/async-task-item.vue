<script setup lang="ts">
import type { AsyncTask } from '@/stores'
import { useAsyncStore } from '@/stores'
import { RegularChromeClose } from '@/ui/g-icons'

defineProps<{
  task: AsyncTask
}>()

const asyncStore = useAsyncStore()

const statusText = (status: AsyncTask['status']) => {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'running':
      return '进行中'
    case 'success':
      return '已完成'
    case 'error':
      return '失败'
    case 'cancelled':
      return '已取消'
  }
}
</script>

<template>
  <div
    :class="[
      'async-task-item px-3 py-2 flex flex-col gap-1',
      'border-b border-[--gl-3]/40 last:border-b-0',
      task.status === 'error' ? 'bg-red-500/5' : '',
    ]"
    :data-status="task.status"
  >
    <div class="flex items-center gap-2">
      <!-- 状态指示 -->
      <div class="shrink-0 size-4 grid place-content-center">
        <template v-if="task.status === 'running' || task.status === 'pending'">
          <div
            class="size-3 rounded-full border-2 border-[--gl-4] border-t-[--color-brand-6] animate-spin"
          />
        </template>
        <template v-else-if="task.status === 'success'">
          <svg viewBox="0 0 16 16" class="size-4 text-green-500">
            <path
              d="M3.5 8.5L6.5 11.5L12.5 5.5"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
        </template>
        <template v-else-if="task.status === 'error'">
          <svg viewBox="0 0 16 16" class="size-4 text-red-500">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" fill="none" />
            <path
              d="M8 5V9M8 11.25V11.75"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </template>
        <template v-else>
          <svg viewBox="0 0 16 16" class="size-4 text-[--gl-5]">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" fill="none" />
            <path d="M5 5L11 11M11 5L5 11" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </template>
      </div>

      <!-- 标题 -->
      <div class="flex-1 min-w-0 text-sm text-[--gl-7] truncate">
        {{ task.title }}
      </div>

      <!-- 百分比 -->
      <div
        v-if="
          (task.status === 'running' || task.status === 'pending') && task.progress !== undefined
        "
        class="shrink-0 text-xs tabular-nums text-[--gl-5]"
      >
        {{ Math.round(task.progress * 100) }}%
      </div>

      <!-- 取消按钮 -->
      <button
        v-if="task.cancellable && (task.status === 'running' || task.status === 'pending')"
        class="shrink-0 h-5 px-1.5 rounded text-xs text-[--gl-6] hover:bg-[--gl-2] transition-colors"
        title="取消该任务"
        @click="asyncStore.cancel(task.id)"
      >
        取消
      </button>

      <!-- 关闭按钮：非运行态 -->
      <button
        v-else-if="task.status !== 'running' && task.status !== 'pending'"
        class="shrink-0 size-5 grid place-content-center rounded text-[--gl-5] hover:bg-[--gl-2] hover:text-[--gl-7] transition-colors"
        title="移除"
        @click="asyncStore.remove(task.id)"
      >
        <RegularChromeClose class="size-3" />
      </button>
    </div>

    <!-- 进度条 -->
    <div
      v-if="task.status === 'running' || task.status === 'pending'"
      class="h-1 w-full rounded-full bg-[--gl-2] overflow-hidden"
    >
      <template v-if="task.progress !== undefined">
        <div
          class="h-full bg-[--color-brand-6] transition-[width] duration-200 ease-out"
          :style="{ width: `${Math.min(100, Math.max(0, task.progress * 100))}%` }"
        />
      </template>
      <template v-else>
        <div class="h-full w-1/3 bg-[--color-brand-6] indeterminate-slide" />
      </template>
    </div>

    <!-- 消息 / 错误 -->
    <div v-if="task.status === 'error'" class="text-xs text-red-500 break-all">
      {{ task.error ?? statusText(task.status) }}
    </div>
    <div
      v-else-if="task.message || task.description"
      class="text-xs text-[--gl-5] truncate"
      :title="task.message || task.description"
    >
      {{ task.message || task.description }}
    </div>
  </div>
</template>

<style scoped>
@keyframes indeterminate-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
.indeterminate-slide {
  animation: indeterminate-slide 1.4s ease-in-out infinite;
}
</style>
