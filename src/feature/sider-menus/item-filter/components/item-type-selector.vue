<script lang="ts">
export interface ItemTypeSelectorProps {
  /** 可选的物品分类列表（仅末端分类） */
  itemTypeList: ItemTypeVo[]
  /** 当前选中的分类 id */
  itemTypeId?: number
}
</script>

<script setup lang="ts">
import type { ItemTypeVo } from '@/api/services/main/globals'
import IconRenderer from '@/components/icon-renderer/icon-renderer.vue'

defineProps<ItemTypeSelectorProps>()

defineEmits<{
  /** 点击分类时上报其 id；选中/取消的语义由父级决定 */
  'update:itemTypeId': [number]
}>()
</script>

<template>
  <div
    data-role="物品类型选区"
    class="absolute w-[calc(100%+0.25rem)] h-full left-0 overflow-auto relative"
    style="scrollbar-width: none"
  >
    <div class="">
      <div
        v-for="itemType in itemTypeList"
        :key="itemType.id"
        :class="[
          'h-10 w-full relative group',
          'rounded-[0.5rem_0_0_0.5rem] select-none text-sm overflow-hidden',
          itemTypeId === itemType.id
            ? 'sticky top-0 bottom-0 bg-white text-gray-900 z-1'
            : 'text-gray-500',
        ]"
      >
        <div
          class="absolute left-0 top-0 h-full w-[calc(100%-0.25rem)] px-2 py-2 flex items-center gap-2 cursor-pointer group-active:translate-y-0.5"
          @click="$emit('update:itemTypeId', itemType.id!)"
        >
          <IconRenderer
            class="size-6 shrink-0"
            :classes="{ img: itemTypeId === itemType.id ? 'opacity-100' : 'opacity-50' }"
            :icon-id="itemType.iconId"
          />
          <span class="whitespace-nowrap overflow-hidden text-ellipsis">
            {{ itemType.name }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
