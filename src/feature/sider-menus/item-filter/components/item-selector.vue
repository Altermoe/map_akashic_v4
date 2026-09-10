<script lang="ts">
export interface ItemSelectorProps {
  /** 展示用的虚拟物品组列表（已完成检索过滤） */
  items: VirtualItemGroup[]
  /** 已选中的虚拟组 id 集合 */
  selectedIds: Set<string>
}
</script>

<script setup lang="ts">
import type { VirtualItemGroup } from '../types'

defineProps<ItemSelectorProps>()

defineEmits<{
  /** 点击虚拟组时上报其 id；选中状态由父级持有 */
  toggle: [id: string]
}>()
</script>

<template>
  <div data-role="物品选区" class="flex-1 h-full overflow-hidden bg-white rounded-md relative">
    <div
      class="absolute inset-0 w-full h-full overflow-auto"
      style="
        scrollbar-width: thin;
        mask: linear-gradient(
          to bottom,
          transparent,
          #fff 0.5rem,
          #fff calc(100% - 0.5rem),
          transparent
        );
      "
    >
      <div class="grid grid-cols-2 p-2 gap-1.5">
        <div
          v-for="item in items"
          :key="item.id"
          :class="[
            'relative',
            'flex h-12 gap-2 text-sm select-none cursor-pointer rounded-full outline-1 -outline-offset-1',
            selectedIds.has(item.id) ? 'outline-gray-500' : 'outline-transparent',
          ]"
          style="content-visibility: auto"
          @click="$emit('toggle', item.id)"
        >
          <div
            :class="[
              'h-full aspect-square bg-clip-content shrink-0 rounded-full',
              selectedIds.has(item.id)
                ? 'bg-[image:radial-gradient(var(--colors-gray-500)_50%,transparent_55%),conic-gradient(from_0deg,transparent_0deg_90deg,var(--colors-gray-300)_90deg_270deg)]'
                : 'bg-[image:radial-gradient(var(--colors-gray-500)_50%,transparent_55%),conic-gradient(from_0deg,transparent_0deg_90deg,var(--colors-gray-300)_90deg_270deg)]',
            ]"
          ></div>
          <!-- <IconRenderer class="size-7 shrink-0" :icon-id="item.iconId" /> -->
          <div class="py-1">
            <div
              class="inline-block w-full whitespace-nowrap overflow-hidden text-ellipsis text-xs"
            >
              {{ item.name }}
            </div>
            <div class="text-xs text-gray-300">0 / 123</div>
          </div>
          <!-- <div class="absolute left-0 bottom-0 z-1 w-full h-1 bg-gray-300" /> -->
        </div>
      </div>
    </div>
  </div>
</template>
