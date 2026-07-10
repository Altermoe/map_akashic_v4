<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { useAsyncStore } from '@/stores'
import AsyncTaskItem from './async-task-item.vue'

const asyncStore = useAsyncStore()

const open = ref(false)
</script>

<template>
  <PopoverRoot v-if="asyncStore.hasVisibleTasks" v-model:open="open">
    <PopoverTrigger
      :class="[
        'async-tasks-trigger',
        'fixed bottom-4 right-4 z-50',
        'flex items-center gap-2 pl-3 pr-3.5 h-10 rounded-full',
        'bg-[--gl-1] border border-[--gl-3]',
        'shadow-lg text-[--gl-7]',
        'hover:bg-[--gl-2] active:bg-[--gl-3]',
        'transition-colors select-none cursor-pointer',
      ]"
      :aria-label="`当前有 ${asyncStore.runningCount} 个任务正在进行`"
    >
      <!-- 旋转指示器 / 完成状态 -->
      <div class="relative size-5 grid place-content-center">
        <template v-if="asyncStore.hasRunning">
          <div
            class="size-4 rounded-full border-2 border-[--gl-3] border-t-[--color-brand-6] animate-spin"
          />
        </template>
        <template v-else>
          <svg viewBox="0 0 16 16" class="size-4 text-[--color-brand-6]">
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

        <!-- 失败徽标 -->
        <span
          v-if="asyncStore.hasError"
          class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500 ring-1 ring-[--gl-1]"
        />
      </div>

      <div class="text-xs tabular-nums leading-none">
        <template v-if="asyncStore.hasRunning"> {{ asyncStore.runningCount }} 项进行中 </template>
        <template v-else> 任务列表 </template>
      </div>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        :side-offset="8"
        :collision-padding="16"
        side="top"
        align="end"
        :class="[
          'async-tasks-content',
          'w-80 max-h-[60dvh] overflow-hidden',
          'rounded-xl border border-[--gl-3]/50',
          'bg-[--gl-0] shadow-xl',
          'flex flex-col',
          'z-50',
        ]"
      >
        <!-- 标题栏 -->
        <div
          class="shrink-0 flex items-center px-3 h-9 border-b border-[--gl-3]/50 text-sm text-[--gl-7]"
        >
          <div class="flex-1">异步任务</div>
          <button
            v-if="asyncStore.list.some((t) => t.status !== 'running' && t.status !== 'pending')"
            class="px-2 h-6 text-xs rounded text-[--gl-6] hover:bg-[--gl-2] transition-colors"
            @click="asyncStore.clearFinished"
          >
            清除已完成
          </button>
        </div>

        <!-- 列表 -->
        <div class="flex-1 overflow-y-auto">
          <AsyncTaskItem v-for="task in asyncStore.list" :key="task.id" :task="task" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
