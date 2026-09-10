<script lang="ts">
export interface AreaSelectorProps {
  /** 当前选择的地区 code */
  areaCode?: string
  /** 地区 code 索引表 */
  areaCodeMap?: Map<string | undefined, AreaVo>
  /** 当前作用域内物品数量 */
  count?: number
  /** 物品总数 */
  total?: number
}
</script>

<script setup lang="ts">
import type { AreaVo } from '@/api/services/main/globals'
import IconRenderer from '@/components/icon-renderer/icon-renderer.vue'

const props = defineProps<AreaSelectorProps>()

/** 当前选中的地区 */
const selectedArea = computed(() => {
  const code = props.areaCode?.trim()
  if (!code) return undefined
  return props.areaCodeMap?.get(code)
})

/** 展示用的父级地区：选中末端地区时取其父级，否则取选中地区自身 */
const parentArea = computed(() => {
  const selected = selectedArea.value
  if (!selected) return undefined
  if (!selected.isFinal) return selected
  const parentId = selected.parentId
  if (parentId === undefined) return undefined
  for (const area of props.areaCodeMap?.values() ?? []) {
    if (area.id === parentId) return area
  }
  return undefined
})

/** 展示用的末端地区：仅当选中的是末端地区时存在 */
const childArea = computed(() => {
  const selected = selectedArea.value
  return selected?.isFinal ? selected : undefined
})
</script>

<template>
  <div data-role="地区选择区" class="w-full h-32 shrink-0 flex gap-x-2 mb-2">
    <div class="size-32 bg-white rounded-xl shrink-0 overflow-hidden">
      <IconRenderer class="size-full" :icon-id="selectedArea?.iconId">
        <template #empty>
          <div class="w-full h-full bg-gray-200 grid place-content-center">Area Icon</div>
        </template>
      </IconRenderer>
    </div>
    <div class="flex-1 h-full overflow-hidden text-right flex flex-col">
      <div class="flex-1 overflow-hidden">
        <div class="text-2xl font-bold">{{ parentArea?.name ?? 'Parent Area Name' }}</div>
        <div class="text-sm text-gray-700">{{ childArea?.name ?? 'Child Area Name' }}</div>
        <div class="shrink-0 text-sm text-gray-700">{{ count ?? 0 }} / {{ total ?? 0 }}</div>
      </div>
    </div>
  </div>
</template>
