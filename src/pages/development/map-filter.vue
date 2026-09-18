<script setup lang="ts">
import { useUrlSearchParams } from '@vueuse/core'
import ItemFilter from '@/feature/sider-menus/item-filter/index.vue'
import { useAreaStore } from '@/stores/area'
import { useIconStore } from '@/stores/icon'
import { useItemStore } from '@/stores/item'
import { useItemTypeStore } from '@/stores/item-type'

definePage({
  meta: {
    title: '筛选器',
  },
})

const params = useUrlSearchParams<{
  selectedAreaCode?: string
  itemTypeId?: string
  itemIds?: string[]
}>('history')

const itemTypeId = computed({
  get: () => {
    return params.itemTypeId ? Number(params.itemTypeId) : undefined
  },
  set: (value) => {
    params.itemTypeId = value === undefined ? undefined : `${value}`
  },
})
const itemIds = computed({
  get: () => {
    return params.itemIds?.map(Number) ?? []
  },
  set: (values) => {
    params.itemIds = values.map(String)
  },
})

const areaStore = useAreaStore()
const itemStore = useItemStore()
const iconStore = useIconStore()
const itemTypeStore = useItemTypeStore()
</script>

<template>
  <div class="w-full h-full flex bg-cover bg-no-repeat relative" style="background: #999">
    <!-- 亮色模式开发区域 -->
    <div class="relative flex-1 p-4">
      <ItemFilter
        v-model:area-code="params.selectedAreaCode"
        v-model:item-type-id="itemTypeId"
        v-model:item-ids="itemIds"
        style="color-scheme: light"
        :area-id-map="areaStore.areaIdMap"
        :area-code-map="areaStore.areaCodeMap"
        :item-type-id-map="itemTypeStore.idMap"
        :item-type-loading="itemTypeStore.loading"
        :item-id-map="itemStore.idMap"
        :icon-id-map="iconStore.idMap"
      />
    </div>

    <!-- 暗色模式开发区域 -->
    <div class="relative flex-1 p-4">
      <ItemFilter
        v-model:area-code="params.selectedAreaCode"
        v-model:item-type-id="itemTypeId"
        v-model:item-ids="itemIds"
        style="color-scheme: dark"
        :area-id-map="areaStore.areaIdMap"
        :area-code-map="areaStore.areaCodeMap"
        :item-type-id-map="itemTypeStore.idMap"
        :item-type-loading="itemTypeStore.loading"
        :item-id-map="itemStore.idMap"
        :icon-id-map="iconStore.idMap"
      />
    </div>

    <div
      class="absolute left-0 bottom-0 bg-white w-full h-4.5rem px-2 py-1 rounded-lg border-2 border-red-500"
    >
      <div data-role="debug panel" class="w-full text-sm">
        <div class="flex gap-1">
          <div class="w-5em">AreaCode:</div>
          <pre class="text-xs">{{ `${params.selectedAreaCode}` }}</pre>
        </div>
        <div class="flex gap-1">
          <div class="w-5em">ItemType:</div>
          <pre class="text-xs">{{ `${itemTypeId}` }}</pre>
        </div>
        <div class="flex gap-1">
          <div class="w-5em">ItemIds:</div>
          <pre class="text-xs">{{ `${itemIds.toSorted((a, b) => a - b).join(',')}` }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
