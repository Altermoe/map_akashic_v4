<script lang="ts">
export interface AreaSelectorProps {
  /** 当前选择的地区 code */
  areaCode?: string
  /** 地区 code 索引表 */
  areaCodeMap: Map<string | undefined, AreaVo>
  /** 地区 id 索引表 */
  areaIdMap: Map<number | undefined, AreaVo>
  /** 图标 id 索引表 */
  iconIdMap: Map<number | undefined, IconVo>
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
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'reka-ui'
import type { AreaVo, IconVo } from '@/api/services/main/globals'
import IconRenderer from '@/components/icon-renderer/icon-renderer.vue'
import TintIconRenderer from './tint-icon-renderer.vue'

const props = withDefaults(defineProps<AreaSelectorProps>(), {
  areaIdMap: () => new Map<number | undefined, AreaVo>(),
})

const dialogVisible = ref(false)

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

/** 一级地区预留给【星球】层级 */
// TODO: areaLevel1List

/** 二级地区列表 */
const areaLevel2List = computed(() => {
  return (
    props.areaCodeMap
      ?.entries()
      .map((entry) => entry[1])
      .filter((area) => area.id !== undefined && (area.code?.startsWith('C:') ?? false))
      .toArray()
      .toSorted((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)) ?? []
  ).map((area) => {
    return { ...area, id: area.id as number }
  })
})

/** 当前在 Tab 中激活的二级地区 id，跟随选中地区变化 */
const activeLevel2Id = computed<number | undefined>(() => {
  const selected = selectedArea.value
  if (!selected) return undefined
  if (!selected.isFinal) return selected.id
  return parentArea.value?.id
})

/** Tab 激活值 */
const activeTab = ref<number | undefined>(undefined)
watch(
  () => activeLevel2Id.value,
  (id) => {
    if (id !== undefined) activeTab.value = id
  },
  { immediate: true },
)

/** 取指定父级地区的三级地区列表 */
const getLevel3List = (parentArea: AreaVo): AreaVo[] =>
  props.areaCodeMap
    ?.entries()
    .map((entry) => entry[1])
    .filter((area) => area.code?.startsWith('A:') && area.parentId === parentArea.id)
    .toArray()
    .toSorted((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)) ?? []

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
  const tr = document.startViewTransition(() => {
    dialogVisible.value = open
  })
  tr.ready.catch(() => {
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
      <DialogOverlay
        class="fixed left-0 top-0 w-100dvw h-100dvh bg-black bg-opacity-70 z-1001 backdrop-blur-xs"
      />
      <DialogContent
        :class="[
          'w-100dvw max-w-240 min-h-120 mx-auto rounded-lg p-2',
          'absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-1002',
          'text-white',
        ]"
      >
        <DialogTitle class="text-4xl font-bold">地区选择</DialogTitle>
        <DialogDescription>咦……？</DialogDescription>

        <div data-role="二级地区选择" class="w-full">
          <TabsRoot v-model="activeTab" class="w-full">
            <TabsList class="w-full flex gap-1 overflow-x-auto p-1 bg-white/10 rounded-lg">
              <TabsTrigger
                v-for="area in areaLevel2List"
                :key="area.id"
                :value="area.id"
                class="shrink-0 px-4 py-2 text-sm rounded-lg whitespace-nowrap hover:bg-white/10 data-[state=active]:bg-white/25"
              >
                {{ area.name }}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              v-for="area in areaLevel2List"
              :key="area.id"
              :value="area.id"
              class="pt-4 select-none"
            >
              <div data-role="三级地区选择" class="flex flex-wrap gap-3">
                <div
                  v-for="child in getLevel3List(area)"
                  :key="child.id"
                  class="w-64 h-24 rounded-lg overflow-hidden p-2 flex group hover:bg-white bg-opacity-10"
                >
                  <TintIconRenderer
                    class="size-20 group-hover:[--tint-color:blue]"
                    :area="child"
                    :icon-id-map="props.iconIdMap"
                    :area-id-map="props.areaIdMap"
                  />
                  <div>
                    <div class="text-lg leading-tight whitespace-nowrap">{{ child.name }}</div>
                    <div class="text-xs text-gray-400">{{ `id: ${child.id}` }}</div>
                    <div class="text-xs text-gray-400">{{ `code: ${child.code}` }}</div>
                    <div class="text-xs text-gray-400">{{ `parentId: ${child.parentId}` }}</div>
                    <div class="text-xs text-gray-400">{{ `iconId: ${child.iconId}` }}</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </TabsRoot>
        </div>

        <DialogClose>关闭弹窗</DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
