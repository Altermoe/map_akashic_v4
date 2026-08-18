<script setup lang="ts">
import { useRequest } from 'alova/client'
import {
  CheckboxIndicator,
  CheckboxRoot,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from 'reka-ui'
import { useI18n } from 'vue-i18n'
import Api from '@/api'
import type { ItemTypeVo } from '@/api/services/main/globals'
import IconRenderer from '@/components/icon-renderer/icon-renderer.vue'
import { StorageKey } from '@/shared/enums/storage-key'
import { useFilterStore, useItemCatalogStore } from '@/stores'

const { t } = useI18n({ useScope: 'global' })
const filterStore = useFilterStore()
const catalogStore = useItemCatalogStore()

// ─── 类型树数据 ────────────────────────────────────
const { data: rawTypeList, loading: typeLoading } = useRequest(
  Api.main.item_type.listItemType({
    cacheFor: { mode: 'restore', expire: 60 * 60 * 1000 },
    transform: (data) => data.data ?? [],
  }),
  { initialData: [] },
)

const typeById = computed(() => new Map(rawTypeList.value.map((ty) => [ty.id!, ty])))
const childrenOf = (parentId: number) => rawTypeList.value.filter((ty) => ty.parentId === parentId)

/** 父类型：根节点（parentId = -1） */
const parentTypes = computed(() =>
  rawTypeList.value
    .filter((ty) => (ty.parentId ?? -1) === -1)
    .toSorted((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)),
)

const selectedParentId = ref<number | null>(null)

// 类型数据就绪后默认选中第一个父类型
watch(
  parentTypes,
  (list) => {
    if (selectedParentId.value == null && list.length) selectedParentId.value = list[0].id!
  },
  { immediate: true },
)

/** 选中父类型下的全部末端类型（递归收集，叶子父类型自身可勾选） */
const childTypes = computed<ItemTypeVo[]>(() => {
  if (selectedParentId.value == null) return []
  const result: ItemTypeVo[] = []
  const stack: number[] = [selectedParentId.value]
  const visited = new Set<number>()
  while (stack.length) {
    const pid = stack.pop()!
    if (visited.has(pid)) continue
    visited.add(pid)
    let hasChild = false
    for (const ty of childrenOf(pid)) {
      hasChild = true
      if (ty.isFinal) result.push(ty)
      else stack.push(ty.id!)
    }
    if (!hasChild) {
      const self = typeById.value.get(pid)
      if (self?.isFinal) result.push(self)
    }
  }
  return result.toSorted((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0))
})

// ─── 勾选状态（localStorage 持久化） ────────────────
const loadChecked = (): number[] => {
  try {
    const raw = localStorage.getItem(StorageKey.FILTER_CUSTOM_TYPE_IDS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : []
  } catch {
    return []
  }
}

const checkedTypeIds = ref<number[]>(loadChecked())

watch(checkedTypeIds, (ids) => {
  localStorage.setItem(StorageKey.FILTER_CUSTOM_TYPE_IDS, JSON.stringify(ids))
})

const isChecked = (id: number) => checkedTypeIds.value.includes(id)

const toggleType = (id: number) => {
  checkedTypeIds.value = isChecked(id)
    ? checkedTypeIds.value.filter((x) => x !== id)
    : [...checkedTypeIds.value, id]
}

const selectedCount = computed(() => checkedTypeIds.value.length)

const clearAll = () => {
  checkedTypeIds.value = []
}

// ─── 筛选应用：仅自定义模式生效 ────────────────────
watch(
  [checkedTypeIds, () => filterStore.mode],
  ([ids, mode], [oldIds, oldMode]) => {
    if (mode !== 'custom') return
    // 纯 mode 切换已由 store 恢复快照，无需重复应用
    if (oldMode === 'custom' && ids === oldIds) return
    void filterStore.applyFilter('custom', { typeIds: ids })
  },
  { immediate: true },
)

// 进入自定义模式时确保目录已加载（类型计数与筛选共用）
watch(
  () => filterStore.mode,
  (m) => {
    if (m === 'custom') void catalogStore.ensureLoaded()
  },
)

// ─── 实时反馈 ───────────────────────────────────────
const matchedCount = computed(() => filterStore.result.length)
const countOf = (typeId: number) => catalogStore.typeItemIds.get(typeId)?.length ?? 0
</script>

<template>
  <div
    class="gi-panel flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden rounded-xl border border-[--gi-border] bg-[--gi-bg] p-3 text-[--gi-text] shadow-[0_0_0.75rem_var(--gi-gold-faint)] backdrop-blur-sm"
  >
    <!-- 说明 -->
    <p class="shrink-0 text-xs leading-relaxed text-[--gi-text-dim]">
      {{ t('sider.filter.custom.hint') }}
    </p>

    <!-- 类型双栏 -->
    <div
      class="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-[--gi-border] bg-[--gi-surface]"
    >
      <!-- 父类型列表 -->
      <ScrollAreaRoot
        class="w-36 shrink-0 overflow-hidden border-r border-[--gi-border] [--scrollbar-size:0.4rem]"
      >
        <ScrollAreaViewport class="h-full w-full">
          <template v-if="typeLoading">
            <div v-for="i in 6" :key="i" class="flex h-9 items-center gap-2 px-2.5">
              <div class="size-5 rounded-full animate-pulse bg-[--gi-surface-active]" />
              <div class="h-4 flex-1 rounded animate-pulse bg-[--gi-surface-active]" />
            </div>
          </template>
          <button
            v-for="ty in parentTypes"
            v-else
            :key="ty.id"
            type="button"
            class="flex h-9 w-full cursor-pointer select-none items-center gap-2 px-2.5 text-sm transition-colors"
            :class="
              ty.id === selectedParentId
                ? 'bg-[--gi-gold-soft] font-medium text-[--gi-gold-bright]'
                : 'text-[--gi-text] hover:bg-[--gi-surface-hover]'
            "
            @click="selectedParentId = ty.id!"
          >
            <IconRenderer class="size-5 shrink-0 rounded-full" :icon-id="ty.iconId" />
            <span class="truncate">{{ ty.name }}</span>
          </button>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="w-[--scrollbar-size]">
          <ScrollAreaThumb class="rounded-full bg-[--gi-border-strong]/60" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>

      <!-- 子类型 checkbox 组 -->
      <ScrollAreaRoot class="min-w-0 flex-1 overflow-hidden [--scrollbar-size:0.4rem]">
        <ScrollAreaViewport class="h-full w-full">
          <div v-if="childTypes.length" class="flex flex-col gap-1 p-2">
            <label
              v-for="ty in childTypes"
              :key="ty.id"
              class="flex h-9 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-[--gi-surface-hover]"
              :class="isChecked(ty.id!) ? 'text-[--gi-gold-bright]' : 'text-[--gi-text]'"
            >
              <CheckboxRoot
                :checked="isChecked(ty.id!)"
                class="flex size-4 shrink-0 items-center justify-center rounded border border-[--gi-border-strong] bg-[--gi-bg-elevated] transition-colors data-[state=checked]:border-[--gi-gold-bright] data-[state=checked]:bg-[--gi-gold]"
                @update:checked="toggleType(ty.id!)"
              >
                <CheckboxIndicator class="text-[10px] leading-none text-white">✓</CheckboxIndicator>
              </CheckboxRoot>
              <IconRenderer class="size-5 shrink-0 rounded-full" :icon-id="ty.iconId" />
              <span class="truncate">{{ ty.name }}</span>
              <span class="ml-auto shrink-0 text-xs text-[--gi-text-dim]">
                {{ catalogStore.loaded ? countOf(ty.id!) : '…' }}
              </span>
            </label>
          </div>
          <p v-else class="py-10 text-center text-xs text-[--gi-text-dim]">
            {{ t('sider.filter.custom.empty') }}
          </p>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="w-[--scrollbar-size]">
          <ScrollAreaThumb class="rounded-full bg-[--gi-border-strong]/60" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>
    </div>

    <!-- 底部状态栏 -->
    <div class="flex shrink-0 items-center justify-between border-t border-[--gi-border] pt-2">
      <span class="text-xs text-[--gi-text-dim]">
        {{ t('sider.filter.custom.selected', { n: selectedCount }) }}
        <template v-if="filterStore.loading"> · {{ t('sider.filter.custom.loading') }}</template>
        <template v-else> · {{ t('sider.filter.custom.match', { n: matchedCount }) }}</template>
      </span>
      <button
        type="button"
        class="cursor-pointer text-xs text-[--gi-text-dim] transition-colors hover:text-[--gi-element-pyro]"
        @click="clearAll"
      >
        {{ t('sider.filter.custom.clear') }}
      </button>
    </div>
  </div>
</template>
