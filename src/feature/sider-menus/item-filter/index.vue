<script lang="ts">
export interface ItemFilterProps {
  // ==================== 可变属性 ====================
  /** 当前选择的地区 */
  areaCode?: string
  /** 当前选择的物品分类 */
  itemTypeId?: number
  /** 当前已选的物品集合 */
  itemIds?: number[]

  // ==================== 只读属性 ====================
  /** 地区 code 索引表 */
  areaCodeMap?: Map<string | undefined, AreaVo>
  /** 地区 id 索引表 */
  areaIdMap?: Map<number | undefined, AreaVo>
  /** 物品分类 id 索引表 */
  itemTypeIdMap?: Map<number | undefined, ItemTypeVo>
  /** 物品 id 索引表 */
  itemIdMap?: Map<number | undefined, ItemVo>
  /** 物品分类列表加载中（用于分类选择骨架屏） */
  itemTypeLoading?: boolean
  /** 图标 id 索引表 */
  iconIdMap?: Map<number | undefined, IconVo>
}
</script>

<script setup lang="ts">
import type { AreaVo, IconVo, ItemTypeVo, ItemVo } from '@/api/services/main/globals'
import AreaSelector from './components/area-selector.vue'
import ItemSelector from './components/item-selector.vue'
import ItemTypeSelector from './components/item-type-selector.vue'
import type { VirtualItemGroup } from './types'

const props = defineProps<ItemFilterProps>()

const emits = defineEmits<{
  'update:areaCode': [string]
  'update:itemTypeId': [number | undefined]
  'update:itemIds': [number[]]
}>()

const sortCompare = (a: number | undefined, b: number | undefined) => {
  if (a === undefined) return 0
  if (b === undefined) return 0
  return b - a
}

const itemTypeList = computed<ItemTypeVo[]>(() => {
  const map = props.itemTypeIdMap
  if (!map) return []
  return map
    .entries()
    .map((entry) => entry[1])
    .filter((type) => type.isFinal)
    .toArray()
    .toSorted((a, b) => sortCompare(a.sortIndex, b.sortIndex))
})

/** 名称搜索关键词（只过滤展示列表，不改变选中组的物品集合） */
const searchKeyword = ref('')

/** 地区作用域：active=false 表示不限地区（areaCode 为空/空白时）；ids 为末端地区 id 集合 */
const areaScope = computed(() => {
  const map = props.areaCodeMap
  const code = props.areaCode?.trim()
  const active = !!code
  const ids = new Set<number>()
  if (!active || !map) return { active, ids }
  const selected = map.get(code)
  if (!selected || selected.id === undefined) return { active, ids }
  if (selected.isFinal) {
    ids.add(selected.id)
  } else {
    for (const area of map.values()) {
      if (area.isFinal && area.id !== undefined && area.parentId === selected.id) {
        ids.add(area.id)
      }
    }
  }
  return { active, ids }
})

/** 作用域内实际物品（地区 + 分类），供虚拟分组与 itemIds 展开使用 */
const scopedItems = computed(() => {
  const map = props.itemIdMap
  if (!map) return []
  const scope = areaScope.value
  const typeId = props.itemTypeId
  const out: { item: ItemVo; id: number }[] = []
  map.forEach((item, itemId) => {
    if (itemId === undefined) return
    if (scope.active && (item.areaId === undefined || !scope.ids.has(item.areaId))) return
    if (typeId != null && !item.typeIdList?.includes(typeId)) return
    out.push({ item, id: itemId })
  })
  return out
})

/** 同作用域内按名合并的虚拟物品组表（key = name），组内 items 为实时实际物品 id */
const virtualGroupMap = computed<Map<string, VirtualItemGroup>>(() => {
  const gmap = new Map<string, VirtualItemGroup>()
  for (const { item, id } of scopedItems.value) {
    const key = `${item.name}`
    let group = gmap.get(key)
    if (!group) {
      group = { id: key, name: key, iconId: item.iconId, items: new Set() }
      gmap.set(key, group)
    }
    group.items.add(id)
  }
  return gmap
})

/** 展示用虚拟物品组列表（在作用域分组基础上再按名称过滤） */
const mergedItemList = computed<VirtualItemGroup[]>(() => {
  const query = searchKeyword.value.trim().toLowerCase()
  const out: VirtualItemGroup[] = []
  for (const g of virtualGroupMap.value.values()) {
    if (query && !g.name.toLowerCase().includes(query)) continue
    out.push(g)
  }
  return out
})

/** 已选中虚拟组 id 集合（状态由本组件持有，按虚拟组 id 计数） */
const selectedVirtualIds = ref<Set<string>>(new Set())

/** 点击切换虚拟组选中态 */
const toggleGroup = (id: string) => {
  const next = new Set(selectedVirtualIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedVirtualIds.value = next
}

/**
 * 实时展开：仅把「当前选中虚拟组」在作用域内的实际物品 id 汇入。
 * 地区/分类变化会改变 virtualGroupMap 中各组的 items，因此 itemIds 自动跟随为最新集合。
 */
const expandedItemIds = computed<number[]>(() => {
  const out: number[] = []
  const seen = new Set<number>()
  for (const g of virtualGroupMap.value.values()) {
    if (!selectedVirtualIds.value.has(g.id)) continue
    for (const id of g.items) {
      if (id !== undefined && !seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  return out
})

watch(expandedItemIds, (v) => emits('update:itemIds', v), { immediate: true })

/** 切换分类选中（再次点击取消） */
const toggleItemType = (typeId: number) => {
  const next: number | undefined = props.itemTypeId === typeId ? undefined : typeId
  emits('update:itemTypeId', next)
}
</script>

<template>
  <div data-role="筛选器顶级容器，负责处理尺寸变化" class="w-112 h-160 relative drop-shadow-lg">
    <div data-role="不关心尺寸的 div 容器" class="absolute inset-0 flex flex-col">
      <AreaSelector
        :area-code="props.areaCode"
        :area-code-map="props.areaCodeMap"
        :area-id-map="props.areaIdMap"
        :icon-id-map="props.iconIdMap"
        :count="scopedItems.length"
        :total="props.itemIdMap?.size ?? 0"
      />

      <div
        data-role="物品选择区"
        class="flex-1 overflow-hidden rounded-xl flex flex-col backdrop-blur-md border border-[#ffffff20] bg-gray-200"
      >
        <div data-role="检索区" class="shrink-0 w-full p-2">
          <input
            v-model="searchKeyword"
            :class="[
              'w-full h-10 bg-gray-300 rounded-md px-4 text-sm outline-2 outline-transparent',
              // 'hover:bg-gray-300 focus:bg-gray-300',
              // 'border border-x-transparent',
              // 'border-t-gray-400 border-b-gray-100',
            ]"
            placeholder="Enter Item Name"
            style="
              box-shadow:
                inset 0 2px 0 hsla(0, 0%, 100%, 0.15),
                inset 0 2px 2px hsla(0, 0%, 0%, 0.1);
            "
          />
        </div>

        <div class="w-full flex-1 overflow-hidden flex px-2 pb-2 drop-shadow">
          <div class="shrink-0 w-28 h-full relative">
            <ItemTypeSelector
              :item-type-list="itemTypeList"
              :item-type-id="props.itemTypeId"
              :loading="props.itemTypeLoading"
              @update:item-type-id="toggleItemType"
            />
          </div>

          <ItemSelector
            :items="mergedItemList"
            :selected-ids="selectedVirtualIds"
            @toggle="toggleGroup"
          />
        </div>
      </div>

      <div
        data-role="debug panel"
        class="bg-white absolute top-0 left-full translate-x-4 left-0 w-full text-sm"
      >
        <pre>{{
          JSON.stringify(
            { areaCode: props.areaCode, itemTypeId: props.itemTypeId, itemIds: props.itemIds },
            null,
            2,
          )
        }}</pre>
      </div>
    </div>
  </div>
</template>
