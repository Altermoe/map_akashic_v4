<script lang="ts">
export interface AreaSelectorProps {
  /** 当前选择的地区 code */
  areaCode?: string
  /** 地区 code 索引表 */
  areaCodeMap?: Map<string | undefined, AreaVo>
  /** 地区 id 索引表 */
  areaIdMap?: Map<number | undefined, AreaVo>
  /** 图标 id 索引表 */
  iconIdMap?: Map<number | undefined, IconVo>
  /** 当前作用域内物品数量 */
  count?: number
  /** 物品总数 */
  total?: number
}
</script>

<script setup lang="ts">
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from 'reka-ui'
import type { AreaVo, IconVo } from '@/api/services/main/globals'
import IconRenderer from '@/components/icon-renderer/icon-renderer.vue'
import { getFallbackIcon } from '@/stores/area/config'

const props = withDefaults(defineProps<AreaSelectorProps>(), {
  areaIdMap: () => new Map<number | undefined, AreaVo>(),
})

const dialogVisible = ref(false)

const areaList = computed(() => {
  return props.areaCodeMap
    ?.entries()
    .map((entry) => entry[1])
    .filter((area) => !area.isFinal)
    .toArray()
    .toSorted((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0))
})

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

const getIcon = (area: AreaVo): string | undefined => {
  if (!props.iconIdMap) return
  return props.iconIdMap.get(area.iconId)?.url
}

const handleVisibleChange = (open: boolean) => {
  document.startViewTransition(() => {
    dialogVisible.value = open
  })
}
</script>

<template>
  <DialogRoot :open="dialogVisible" @update:open="handleVisibleChange">
    <DialogTrigger>
      <div
        data-role="地区选择区"
        class="w-full h-32 shrink-0 flex gap-x-2 mb-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg"
      >
        <div class="size-32 rounded-xl shrink-0 overflow-hidden">
          <IconRenderer class="size-full" :icon-id="selectedArea?.iconId">
            <template #empty>
              <div class="w-full h-full grid place-content-center">Area Icon</div>
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
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="w-100dvw h-100dvh bg-black bg-opacity-70 z-1001 backdrop-blur-xs" />
      <DialogContent
        :class="[
          'w-240 min-h-120 mx-auto rounded-lg',
          'absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-1002',
          'text-white',
        ]"
      >
        <DialogTitle>地区选择</DialogTitle>
        <DialogDescription>选择一个具体的子地区</DialogDescription>
        <div class="w-full flex flex-wrap outline outline-red-300 gap-4">
          <div
            v-for="area in areaList"
            :key="area.id"
            class="w-64 h-24 rounded-lg overflow-hidden flex hover:bg-white bg-opacity-10"
          >
            <div
              class="size-24 bg-contain"
              :style="{
                backgroundImage: `url(${getIcon(area) ?? getFallbackIcon(area, props.areaIdMap)})`,
              }"
            />
            <div>
              <div class="text-lg">{{ area.name }}</div>
              <div>{{ area.iconId }}</div>
            </div>
          </div>
        </div>
        <DialogClose>关闭弹窗</DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
