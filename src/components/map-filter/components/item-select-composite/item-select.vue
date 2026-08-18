<script setup lang="ts">
import { useRequest } from 'alova/client'
import Api from '@/api'
import type { ItemVo } from '@/api/services/main/globals'
import { RegularSearch } from '@/ui/g-icons'
import { useAreaItems } from '../../composables/use-area-items'
import ItemSelectItemList from './item-select-item-list.vue'
import ItemSelectTypeList from './item-select-type-list.vue'

const props = defineProps<{
  areaIdList?: number[]
}>()

const selectedTypeIndex = ref<number>(-2)
const selectedItemIds = defineModel<number[]>('selectedItemIds', {
  required: false,
  default: () => [],
})
const searchText = ref('')

// 地区变化时重置已选物品
watch(
  () => props.areaIdList,
  () => {
    selectedItemIds.value = []
    searchText.value = ''
  },
)

const { data: rawItemTypeList, loading: typeLoading } = useRequest(
  Api.main.item_type.listItemType({
    cacheFor: {
      mode: 'restore',
      expire: 60 * 60 * 1000,
    },
    transform: (data) => data.data ?? [],
  }),
  {
    initialData: [],
  },
)

const itemTypeList = computed(() => {
  const list = rawItemTypeList.value
    .filter(({ isFinal }) => isFinal)
    .toSorted((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0))
  return list
})

// 当前地区物品列表（与已选 chip 共用同一数据源）
const { items: rawItemList, loading: itemLoading } = useAreaItems(() => props.areaIdList)

// 切换左侧类型时前端筛选物品
const itemList = computed(() => {
  const typeId = selectedTypeIndex.value
  const allItems = rawItemList.value
  const query = searchText.value.trim().toLowerCase()

  let filtered: ItemVo[]

  // -1: 已选物品
  if (typeId === -1) {
    const selectedSet = new Set(selectedItemIds.value)
    const result: ItemVo[] = []
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i]
      if (item.id !== undefined && selectedSet.has(item.id)) {
        result.push(item)
      }
    }
    filtered = result
  }
  // -2: 全部分类
  else if (typeId === -2) {
    filtered = allItems
  }
  // 按类型筛选
  else {
    const result: ItemVo[] = []
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i]
      const typeIds = item.typeIdList
      if (typeIds) {
        for (let j = 0; j < typeIds.length; j++) {
          if (typeIds[j] === typeId) {
            result.push(item)
            break
          }
        }
      }
    }
    filtered = result
  }

  // 按名称关键词筛选
  if (query) {
    return filtered.filter((item) => item.name?.toLowerCase().includes(query))
  }

  return filtered
})

// 切换物品选中状态
function toggleItemSelect(itemId: number | undefined) {
  if (itemId === undefined) return
  const idx = selectedItemIds.value.indexOf(itemId)
  if (idx === -1) {
    selectedItemIds.value = [...selectedItemIds.value, itemId]
  } else {
    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== itemId)
  }
}

// 计算每个类型下已选物品的数量
const typeSelectedCountMap = computed(() => {
  const map = new Map<number, number>()
  const selectedSet = new Set(selectedItemIds.value)

  for (const item of rawItemList.value) {
    if (item.id !== undefined && selectedSet.has(item.id) && item.typeIdList) {
      for (const typeId of item.typeIdList) {
        map.set(typeId, (map.get(typeId) || 0) + 1)
      }
    }
  }

  return map
})

// 获取类型已选数量
function getTypeSelectedCount(typeId: number | undefined) {
  if (typeId === undefined) return 0
  if (typeId === -1 || typeId === -2) return selectedItemIds.value.length
  return typeSelectedCountMap.value.get(typeId) || 0
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[--gi-border] bg-[--gi-surface]"
  >
    <div class="shrink-0 p-2 border-b border-[--gi-border]">
      <div
        class="flex h-8 items-center gap-1.5 rounded-md border border-[--gi-border] bg-[--gi-bg-elevated] px-2 transition-colors focus-within:border-[--gi-gold-bright]"
      >
        <RegularSearch class="size-4 shrink-0 text-[--gi-text-dim]" />
        <input
          v-model="searchText"
          type="text"
          class="h-full flex-1 bg-transparent text-sm text-[--gi-text] outline-none placeholder:text-[--gi-text-dim]"
          placeholder="搜索物品..."
        />
      </div>
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <ItemSelectTypeList
        :item-type-list="itemTypeList"
        :selected-type-index="selectedTypeIndex"
        :loading="typeLoading"
        :get-type-selected-count="getTypeSelectedCount"
        @select="(id: number) => (selectedTypeIndex = id)"
      />

      <ItemSelectItemList
        :item-list="itemList"
        :selected-ids="selectedItemIds"
        :loading="itemLoading"
        :has-area="!!areaIdList?.length"
        @toggle="toggleItemSelect"
      />
    </div>
  </div>
</template>
