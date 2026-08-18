<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  PopoverClose,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { useI18n } from 'vue-i18n'
import type { ItemVo } from '@/api/services/main/globals'
import IconRenderer from '@/components/icon-renderer/icon-renderer.vue'
import { useAreaStore, useFilterStore } from '@/stores'
import { RegularSearch } from '@/ui/g-icons'
import AreaSelect from './components/area-select-composite/area-select.vue'
import ItemSelect from './components/item-select-composite/item-select.vue'
import { useAreaItems } from './composables/use-area-items'

const { t } = useI18n({ useScope: 'global' })

const areaStore = useAreaStore()
const filterStore = useFilterStore()

const selectedAreaCode = defineModel<string | undefined>('areaCode', {
  required: false,
  default: '',
})

const selectedParent = computed(() => areaStore.getParentArea(selectedAreaCode.value))
const selectedChild = computed(() => areaStore.getAreaByCode(selectedAreaCode.value))

const selectedAreaIdList = computed(() => (selectedChild.value ? [selectedChild.value.id!] : []))

/** 已选物品 id（basic 筛选器参数） */
const selectedItemIds = ref<number[]>([])

/** 当前地区物品列表（chip 展示与添加弹层共用） */
const { items: areaItems } = useAreaItems(() => selectedAreaIdList.value)

const selectedItemMap = computed(() => {
  const map = new Map<number, ItemVo>()
  for (const item of areaItems.value) {
    if (item.id !== undefined) map.set(item.id, item)
  }
  return map
})

watch(
  selectedItemIds,
  (ids) => {
    filterStore.applyFilter('basic', { itemIds: ids })
  },
  { immediate: true },
)

/** 点位名称搜索：防抖 300ms 后应用/清除 search 筛选器 */
const searchKeyword = ref('')

watchDebounced(
  searchKeyword,
  (keyword) => {
    const trimmed = keyword.trim()
    if (trimmed) {
      filterStore.applyFilter('search', { keyword: trimmed })
    } else {
      filterStore.clearFilter('search')
    }
  },
  { debounce: 300 },
)

/** 已选 chip 云展开态 */
const chipOpen = ref(true)

const removeItem = (id: number) => {
  selectedItemIds.value = selectedItemIds.value.filter((x) => x !== id)
}

const clearSelected = () => {
  selectedItemIds.value = []
}
</script>

<template>
  <div
    class="gi-panel flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto rounded-xl border border-[--gi-border] bg-[--gi-bg] p-3 text-[--gi-text] shadow-[0_0_0.75rem_var(--gi-gold-faint)] backdrop-blur-sm"
  >
    <!-- 点位名称搜索 -->
    <div
      class="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[--gi-border] bg-[--gi-surface] px-2.5 transition-colors focus-within:border-[--gi-gold-bright]"
    >
      <RegularSearch class="size-4 shrink-0 text-[--gi-text-dim]" />
      <input
        v-model="searchKeyword"
        type="search"
        :placeholder="t('sider.filter.search.placeholder')"
        class="h-full flex-1 bg-transparent text-sm text-[--gi-text] outline-none placeholder:text-[--gi-text-dim]"
      />
    </div>

    <!-- 地区选择 -->
    <AreaSelect
      v-model="selectedAreaCode"
      :area-source="areaStore.areaSource"
      :loading="areaStore.loading"
      v-model:selected-parent="selectedParent"
      v-model:selected-child="selectedChild"
      class="shrink-0"
    />

    <!-- 已选物品 chip 云 -->
    <CollapsibleRoot
      v-model:open="chipOpen"
      class="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-[--gi-border] bg-[--gi-surface]"
    >
      <CollapsibleTrigger
        class="flex h-9 cursor-pointer select-none items-center gap-2 px-3 text-sm transition-colors hover:bg-[--gi-surface-hover]"
      >
        <span class="font-medium text-[--gi-text]">{{ t('sider.filter.selected.title') }}</span>
        <span
          v-if="selectedItemIds.length"
          class="rounded-full bg-[--gi-gold-soft] px-1.5 text-xs leading-5 text-[--gi-text-strong]"
        >
          {{ selectedItemIds.length }}
        </span>
        <span
          class="ml-auto text-xs text-[--gi-text-dim] transition-transform duration-150"
          :class="chipOpen ? 'rotate-180' : ''"
          aria-hidden="true"
        >
          ▾
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent class="overflow-hidden data-[state=closed]:hidden">
        <div class="max-h-36 overflow-y-auto p-2">
          <div v-if="selectedItemIds.length" class="flex flex-wrap gap-1.5">
            <button
              v-for="id in selectedItemIds"
              :key="id"
              type="button"
              class="group flex cursor-pointer items-center gap-1.5 rounded-full border border-[--gi-border] bg-[--gi-bg-elevated] py-0.5 pl-1 pr-1.5 text-xs text-[--gi-text] transition-colors hover:border-[--gi-gold-bright]"
              :title="selectedItemMap.get(id)?.name ?? String(id)"
              @click="removeItem(id)"
            >
              <IconRenderer
                class="size-5 shrink-0 rounded-full"
                :icon-id="selectedItemMap.get(id)?.iconId"
              />
              <span class="max-w-28 truncate">{{ selectedItemMap.get(id)?.name ?? id }}</span>
              <span
                class="shrink-0 text-[--gi-text-dim] transition-colors group-hover:text-[--gi-element-pyro]"
              >
                ×
              </span>
            </button>
            <button
              type="button"
              class="cursor-pointer px-1 text-xs text-[--gi-text-dim] transition-colors hover:text-[--gi-element-pyro]"
              @click="clearSelected"
            >
              {{ t('sider.filter.selected.clear') }}
            </button>
          </div>
          <p v-else class="w-full py-3 text-center text-xs text-[--gi-text-dim]">
            {{ t('sider.filter.selected.empty') }}
          </p>
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>

    <!-- 添加物品 -->
    <PopoverRoot>
      <PopoverTrigger as-child>
        <button
          type="button"
          class="h-9 shrink-0 cursor-pointer rounded-lg border border-[--gi-gold] bg-[--gi-gold-soft] text-sm font-medium text-[--gi-text-strong] transition-colors hover:bg-[--gi-gold-faint] active:translate-y-px"
        >
          + {{ t('sider.filter.add.title') }}
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side="right"
          align="start"
          :side-offset="8"
          class="z-50 w-96 rounded-xl border border-[--gi-border-strong] bg-[--gi-bg-elevated] p-2 text-[--gi-text] shadow-[0_0.5rem_1.5rem_rgb(0_0_0/0.35)] outline-none"
        >
          <div class="flex h-96 flex-col">
            <ItemSelect
              v-model:selected-item-ids="selectedItemIds"
              :area-id-list="selectedAreaIdList"
              class="min-h-0 flex-1"
            />
            <div class="mt-2 flex shrink-0 items-center justify-between">
              <span class="text-xs text-[--gi-text-dim]">
                {{ t('sider.filter.selected.count', { n: selectedItemIds.length }) }}
              </span>
              <PopoverClose as-child>
                <button
                  type="button"
                  class="h-8 cursor-pointer rounded-lg border border-[--gi-gold] bg-[--gi-gold-soft] px-4 text-sm font-medium text-[--gi-text-strong] transition-colors hover:bg-[--gi-gold-faint]"
                >
                  {{ t('sider.filter.add.done') }}
                </button>
              </PopoverClose>
            </div>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
