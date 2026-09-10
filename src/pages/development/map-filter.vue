<script setup lang="ts">
import { useUrlSearchParams } from '@vueuse/core'
import type { AreaVo, ItemTypeVo, ItemVo } from '@/api/services/main/globals'
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

const itemTypeId = ref<number>()
const itemIds = ref<number[]>([])

const areaStore = useAreaStore()
const itemStore = useItemStore()
const itemTypeStore = useItemTypeStore()
</script>

<template>
  <div class="w-full h-full flex bg-cover bg-no-repeat" style="background: #999">
    <!-- 亮色模式开发区域 -->
    <div class="relative flex-1 p-4">
      <ItemFilter
        v-model:area-code="params.selectedAreaCode"
        v-model:item-type-id="itemTypeId"
        v-model:item-ids="itemIds"
        style="color-scheme: light"
        :area-code-map="areaStore.areaCodeMap"
        :item-type-id-map="itemTypeStore.idMap"
        :item-id-map="itemStore.idMap"
      />
    </div>

    <!-- 暗色模式开发区域 -->
    <div class="relative flex-1 p-4">
      <ItemFilter
        v-model:area-code="params.selectedAreaCode"
        v-model:item-type-id="itemTypeId"
        v-model:item-ids="itemIds"
        style="color-scheme: dark"
        :area-code-map="areaStore.areaCodeMap"
        :item-id-map="itemStore.idMap"
        :item-type-id-map="itemTypeStore.idMap"
      />
    </div>
  </div>
</template>
