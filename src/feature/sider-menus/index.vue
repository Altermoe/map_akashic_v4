<script setup lang="ts">
import { h, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapseButton from './components/collapse-button.vue'
import SiderButton from './components/sider-button.vue'
import type { SiderItem, SiderPanelContext } from './plugin'
import { registerBuiltinSiderItems, siderItems, siderItemsByLayout } from './plugin'

/**
 * 侧边栏宿主：不持有任何「具体菜单项」的硬编码。
 * 按钮与拓展面板全部来自插件注册中心（siderItems / siderItemsByLayout），
 * 新增/移除条目 = 向注册中心 registerSiderItem / unregisterSiderItem，宿主源码零改动。
 */
const { t } = useI18n()

/** 宿主上下文可由外部提供：当前为地图分区 code（用于 filter 面板） */
const areaCode = defineModel<string | undefined>('areaCode', {
  required: false,
  default: '',
})

const collapsed = ref(true)
const selectedId = ref<string | null>('filter')

// 挂载时注册内置条目，卸载时撤销（可逆副作用）
let cleanup: Array<() => boolean> = []
cleanup = registerBuiltinSiderItems()
onUnmounted(() => {
  cleanup.forEach((fn) => fn())
})

/** 当前选中的条目（响应式跟随注册表与 selectedId） */
const selectedItem = computed<SiderItem | undefined>(() =>
  siderItems.value.find((item) => item.id === selectedId.value),
)

const isMainPanelCollapsed = computed(() => collapsed.value || !selectedId.value)

const toggle = (id: string) => {
  selectedId.value = selectedId.value === id ? null : id
}

/** 选中条目的拓展面板 VNode（组件或工厂函数统一解析）；无面板返回 null */
const panelVNode = computed(() => {
  const item = selectedItem.value
  if (!item?.panel) return null
  const ctx: SiderPanelContext = {
    h,
    areaCode: areaCode.value,
    setAreaCode: (v) => {
      areaCode.value = v
    },
  }
  const panel = item.panel
  // 工厂函数形式：以上下文调用产出 VNode；组件形式：直接渲染
  if (typeof panel === 'function') {
    return (panel as (ctx: SiderPanelContext) => import('vue').VNode | import('vue').Component)(ctx)
  }
  return panel
})
</script>

<template>
  <div
    class="sider-toolbar sider-toolbar-vars fixed top-0 left-0 w-[min(100dvw,24rem)] h-100dvh z-1 pointer-events-none"
  >
    <CollapseButton class="pointer-events-auto" v-model:collapsed="collapsed" />

    <!-- 左侧边条：按插件注册表分 top / bottom 两区渲染 -->
    <div
      :class="[
        'sider-toolbar-left absolute left-0 top-0 z-2 pt-16',
        'w-[calc(var(--tap-width)+1px)] h-full',
        'flex flex-col',
        'border-r-1 border-[--border-color] bg-[--bg-level-1]',
        'select-none',
        collapsed ? 'is-collapsed' : 'pointer-events-auto',
      ]"
    >
      <div class="flex-1 w-full overflow-y-auto overflow-x-hidden scrollbar-hide">
        <SiderButton
          v-for="item in siderItemsByLayout.top"
          :key="item.id"
          :selected="selectedId === item.id"
          :icon="item.icon"
          :label="t(item.name)"
          @click="() => toggle(item.id)"
        />
      </div>

      <div class="shrink-0 overflow-hidden">
        <SiderButton
          v-for="item in siderItemsByLayout.bottom"
          :key="item.id"
          :selected="selectedId === item.id"
          :icon="item.icon"
          :label="t(item.name)"
          @click="() => toggle(item.id)"
        />
      </div>
    </div>

    <!-- 右侧拓展面板：渲染当前选中条目的 panel（无 panel 时展示占位） -->
    <div
      v-if="selectedId"
      :class="[
        'sider-toolbar-right',
        'absolute top-0 left-[var(--tap-width)]',
        'w-100 h-full flex flex-col',
        'bg-[--bg-level-2] border-r-1 border-[--border-color]',
        isMainPanelCollapsed ? 'is-collapsed' : 'pointer-events-auto',
        'is-selected',
      ]"
    >
      <div class="h-17 px-4 gap-2 select-none shrink-0 bg-[--bg-level-1]">
        <div class="text-lg leading-6 font-bold mt-3">{{ t(selectedItem?.name ?? '') }}</div>
        <div>description</div>
      </div>
      <div class="min-h-0 flex-1 overflow-hidden">
        <component v-if="panelVNode" :is="panelVNode" />
        <!-- 无 panel 的条目（如 track）展示占位 -->
        <div v-else class="px-4 pt-4 text-sm text-[--gl-5]">空面板</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sider-toolbar-vars {
  --tap-width: 4rem;
  /* 主题色应做提取 */
  --text-color: var(--color-brand-6);
  --text-active-color: var(--color-brand-5);
  --border-color: var(--gl-3);
  --bg-level-1: var(--gl-1);
  --bg-level-2: var(--gl-3);
  --item-hover-bg: var(--color-brand-1);
  --item-active-bg: var(--color-brand-2);
  --item-selected-bg: var(--color-brand-2);
}

.sider-toolbar {
  color: var(--text-color);
  font-size: 14px;
}

.sider-toolbar-left {
  transition: all 150ms ease;
  clip-path: inset(0 0 0 0);
  opacity: 1;
}
.sider-toolbar-left.is-collapsed {
  clip-path: inset(0 0 50% 0);
  opacity: 0;
}

.sider-toolbar-right {
  min-height: 0;
  transition: all 150ms ease;
  clip-path: inset(0 0 0 0);
  opacity: 1;
  transition-delay: 150ms;
}
.sider-toolbar-right.is-collapsed {
  clip-path: inset(0 50% 0 0);
  opacity: 0;
  transition-delay: 0ms;
}
</style>
