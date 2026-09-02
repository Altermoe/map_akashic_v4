<script setup lang="ts">
import { useUrlSearchParams } from '@vueuse/core'
import ItemFilter from '@/feature/sider-menus/item-filter/index.vue'

definePage({
  meta: {
    title: '筛选器',
  },
})

const params = useUrlSearchParams<{
  selectedAreaCode?: string
}>('history')
</script>

<template>
  <div class="w-full h-full flex">
    <!-- 亮色模式开发区域 -->
    <div class="relative flex-1 bg-light">
      <ItemFilter v-model:area-code="params.selectedAreaCode" style="color-scheme: light" />
    </div>

    <!-- 暗色模式开发区域 -->
    <div class="relative flex-1 bg-dark">
      <ItemFilter v-model:area-code="params.selectedAreaCode" style="color-scheme: dark" />
    </div>
  </div>
</template>
