<script setup lang="ts">
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import CustomFilter from '@/components/map-filter/custom-filter.vue'
import DefaultFilter from '@/components/map-filter/default-filter.vue'
import { useFilterStore, type FilterMode } from '@/stores'

const { t } = useI18n({ useScope: 'global' })

const areaCode = defineModel<string | undefined>('areaCode', {
  required: false,
  default: '',
})

const filterStore = useFilterStore()

/** Tab 与筛选模式双向绑定：切换 Tab 即切换模式（互斥 + 快照保留） */
const tab = computed<FilterMode>({
  get: () => filterStore.mode,
  set: (v) => {
    void filterStore.setMode(v)
  },
})

const tabOptions = [
  { value: 'default', label: t('sider.filter.default.title') },
  { value: 'custom', label: t('sider.filter.custom.title') },
] as const
</script>

<template>
  <div class="gi-theme flex h-full w-full flex-col overflow-hidden p-2">
    <TabsRoot v-model="tab" class="flex min-h-0 flex-1 flex-col">
      <!-- 顶部 Tab -->
      <TabsList
        class="relative mb-2 flex shrink-0 gap-1 rounded-lg border border-[--gi-border] bg-[--gi-surface] p-1"
      >
        <TabsTrigger
          v-for="opt in tabOptions"
          :key="opt.value"
          :value="opt.value"
          class="h-8 flex-1 cursor-pointer select-none rounded-md text-center text-sm leading-8 transition-colors duration-150 hover:bg-[--gi-surface-hover] data-[state=active]:font-medium data-[state=active]:text-[--gi-text-strong] data-[state=inactive]:text-[--gi-text-dim]"
        >
          {{ opt.label }}
        </TabsTrigger>
        <TabsIndicator
          class="absolute bottom-1 h-0.5 rounded-full bg-[--gi-gold-bright] transition-all duration-200"
          style="
            width: var(--reka-tabs-indicator-size);
            transform: translateX(var(--reka-tabs-indicator-position));
          "
        />
      </TabsList>

      <!-- 双 Tab 面板（force-mount 保持各自状态） -->
      <TabsContent value="default" force-mount class="min-h-0 flex-1 data-[state=inactive]:hidden">
        <DefaultFilter v-model:area-code="areaCode" />
      </TabsContent>
      <TabsContent value="custom" force-mount class="min-h-0 flex-1 data-[state=inactive]:hidden">
        <CustomFilter />
      </TabsContent>
    </TabsRoot>
  </div>
</template>
