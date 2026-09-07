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
  /** 地区 code 索引表 - 优先使用, 覆盖 areaList */
  areaCodeMap?: Map<string | undefined, AreaVo>
  /** 物品分类 id 索引表 - 优先使用, 覆盖 itemTypeList */
  itemTypeIdMap?: Map<number | undefined, ItemTypeVo>
  /** 物品 id 索引表 - 优先使用, 覆盖 itemList */
  itemIdMap?: Map<number | undefined, ItemVo>
}
</script>

<script setup lang="ts">
import type { AreaVo, ItemTypeVo, ItemVo } from '@/api/services/main/globals'
import IconRenderer from '@/components/icon-renderer/icon-renderer.vue'

const props = defineProps<ItemFilterProps>()

const emits = defineEmits<{
  'update:areaCode': string
  'update:itemTypeId': string
  'update:itemIds': number[]
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

const mergedItemList = computed<ItemVo[]>(() => {
  const map = props.itemIdMap
  if (!map) return []
  return map
    .entries()
    .map((entry) => entry[1])
    .toArray()
})
</script>

<template>
  <div
    data-role="筛选器顶级容器，负责处理尺寸变化"
    class="item-filter-vars w-96 min-h-128 overflow-hidden relative"
  >
    <div data-role="不关心尺寸的 div 容器" class="absolute inset-0 w-full h-full flex flex-col">
      <div data-role="地区选择区" class="h-20 shrink-0">顶部可选地区</div>

      <div
        data-role="物品选择区"
        class="flex-1 overflow-hidden rounded-xl flex flex-col text-[--color-base] bg-[--bg-0] backdrop-blur-md p-1 border border-[#ffffff20]"
      >
        <div data-role="检索区" class="shrink-0 w-full h-12">
          <input />
        </div>

        <div class="w-full flex-1 overflow-hidden flex">
          <div
            data-role="类型选区"
            class="shrink-0 min-w-40 h-full overflow-auto"
            style="scrollbar-width: none"
          >
            <div>
              <div
                v-for="itemType in itemTypeList"
                :key="itemType.id"
                class="bg-[--bg-1] rounded-md px-3 py-2 m-1 flex gap-2 select-none cursor-pointer"
              >
                <IconRenderer class="size-6 shrink-0" :icon-id="itemType.iconId" />
                <span>{{ itemType.name }}</span>
              </div>
            </div>
          </div>

          <div
            data-role="物品选区"
            class="flex-1 h-full overflow-auto"
            style="scrollbar-width: none"
          >
            <div>
              <div
                v-for="item in mergedItemList"
                :key="item.id"
                class="flex h-8 w-16 gap-2 text-sm"
                style="content-visibility: auto"
              >
                <IconRenderer class="size-7 shrink-0" :icon-id="item.iconId" />
                <span>{{ item.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-filter-vars {
  /* --color-base: light-dark(
    oklch(var(--dark-3) var(--dark-chroma-0) var(--hue-primary)),
    oklch(var(--light-0) var(--light-chroma-0) var(--hue-primary))
  ); */
  --color-base: contrast-color(var(--bg-0));
  --bg-0: light-dark(
    oklch(var(--light-0) var(--light-chroma-6) var(--hue-primary) / 20%),
    oklch(var(--dark-2) var(--dark-chroma-3) var(--hue-primary) / 20%)
  );
  --bg-1: light-dark(
    oklch(var(--light-2) var(--light-chroma-4) var(--hue-primary) / 70%),
    oklch(var(--dark-3) var(--dark-chroma-3) var(--hue-primary) / 35%)
  );

  --bg-2: light-dark(
    oklch(var(--light-0) var(--light-chroma-3) var(--hue-primary) / 75%),
    oklch(var(--dark-2) var(--dark-chroma-3) var(--hue-primary) / 45%)
  );
}
</style>
