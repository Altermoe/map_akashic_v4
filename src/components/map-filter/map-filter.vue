<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useAreaStore, useFilterStore } from '@/stores'
import AreaSelect from './components/area-select-composite/area-select.vue'
import FilterModeSelector from './components/filter-mode-selector.vue'
import ItemSelect from './components/item-select-composite/item-select.vue'

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

const selectedFilterModeIndex = ref(0)

const selectedItemIds = ref<number[]>([])

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
</script>

<template>
  <div
    :class="[
      'map-filter',
      'w-96 h-120 p-1 rounded-xl flex flex-col bg-[--bg] shadow-[0_0_2px_var(--gl-1),0_0_0.5rem_var(--gl-1)] text-[--text-color]',
    ]"
  >
    <!-- 点位名称搜索 -->
    <input
      v-model="searchKeyword"
      type="search"
      :placeholder="t('sider.filter.search.placeholder')"
      class="w-full px-3 py-2 mb-1 rounded-xl text-sm bg-[--gl-1] hover:bg-[--gl-2] outline-none placeholder:opacity-60"
    />

    <!-- 筛选类型 -->
    <FilterModeSelector v-model:selected-index="selectedFilterModeIndex" />

    <!-- 地区选择器 -->
    <AreaSelect
      v-model="selectedAreaCode"
      :area-source="areaStore.areaSource"
      :loading="areaStore.loading"
      v-model:selected-parent="selectedParent"
      v-model:selected-child="selectedChild"
    />

    <!-- 物品选择器（含类型） -->
    <ItemSelect v-model:selected-item-ids="selectedItemIds" :area-id-list="selectedAreaIdList" />
  </div>
</template>

<style lang="css" scoped>
.map-filter {
  --bg: light-dark(oklch(0.99 0 0), oklch(0.31 0.02 251.5));
  --text-color: light-dark(oklch(0.38 0.02 269.72), oklch(0.92 0.02 83.06));
}
</style>
