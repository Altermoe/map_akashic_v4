<script setup lang="ts">
import { useUrlSearchParams } from '@vueuse/core'
import ItemFilter from '@/feature/sider-menus/item-filter/index.vue'
import { useAreaStore } from '@/stores/area'
import { useItemStore } from '@/stores/item'
import { useItemTypeStore } from '@/stores/item-type'

definePage({
  meta: {
    title: '筛选器',
  },
})

const params = useUrlSearchParams<{
  selectedAreaCode?: string
}>('history')

const areaStore = useAreaStore()
const itemStore = useItemStore()
const itemTypeStore = useItemTypeStore()
</script>

<template>
  <div class="w-full h-full flex bg-cover bg-no-repeat" style="background-image: url('/demo.png')">
    <!-- 亮色模式开发区域 -->
    <div class="relative flex-1 p-4">
      <ItemFilter
        v-model:area-code="params.selectedAreaCode"
        style="color-scheme: light"
        :area-code-map="areaStore.areaCodeMap"
        :item-id-map="itemStore.idMap"
        :item-type-id-map="itemTypeStore.idMap"
      />
    </div>

    <!-- 暗色模式开发区域 -->
    <div class="relative flex-1 p-4">
      <ItemFilter
        v-model:area-code="params.selectedAreaCode"
        style="color-scheme: dark"
        :area-code-map="areaStore.areaCodeMap"
        :item-id-map="itemStore.idMap"
        :item-type-id-map="itemTypeStore.idMap"
      />
    </div>
  </div>
</template>
