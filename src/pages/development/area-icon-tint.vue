<script setup lang="ts">
import { clampRgb, formatHex } from 'culori'
import { OklchColorPicker } from '@/feature/sider-menus/item-setting/oklch-color-picker'

definePage({
  meta: {
    title: '区域图标着色',
  },
})

// ─── assets/area 图片：Vite glob 静态收集，避免手写 22 个 import ───
const iconModules = import.meta.glob<string>('@/assets/area/*', {
  eager: true,
  import: 'default',
})
const icons = computed(() =>
  Object.entries(iconModules)
    .map(([path, url]) => ({
      name: path.split('/').pop() ?? path,
      url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

// ─── 着色状态 (oklch 三通道，feeds OklchColorPicker) ─────────────
const brandL = ref(0.62)
const brandC = ref(0.14)
const brandH = ref(210)

// 实时换算成可渲染的 CSS 颜色
const tintColor = computed(() =>
  formatHex(clampRgb({ mode: 'oklch', l: brandL.value, c: brandC.value, h: brandH.value })),
)

// 原图 / 着色 切换，用于对照演示 CSS mask 洗色效果
const showOriginal = ref(false)

// ─── 着色层 style：background-image(纯色渐变) + mask(图标形状) 实时洗色 ─
function tintStyle(url: string): Record<string, string> {
  const mask = `url(${url}) center / contain no-repeat`
  return {
    backgroundImage: `linear-gradient(${tintColor.value}, ${tintColor.value})`,
    mask,
    WebkitMask: mask,
  }
}
</script>

<template>
  <div class="flex h-full">
    <!-- 左：assets/area 图标网格 -->
    <main class="flex-1 overflow-auto p-4">
      <p class="mb-3 text-sm text-[--gl-4]">
        共 {{ icons.length }} 张区域图标，当前着色色值为
        <code class="px-1 rounded bg-[--gl-1] text-[--gl-8]">{{ tintColor }}</code>
      </p>
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(112px, 1fr))">
        <div
          v-for="icon in icons"
          :key="icon.name"
          class="flex flex-col items-center gap-2 rounded-lg border border-[--gl-2] p-3 bg-[--gl-0]"
          :title="icon.name"
        >
          <!-- 图标展示区：checkerboard 底便于观察透明区域 -->
          <div
            class="size-20 relative overflow-hidden rounded"
            style="background-image: repeating-conic-gradient(#00000012 0% 25%, transparent 0% 50%)"
          >
            <!-- 原图层（开启“原图”时展示） -->
            <img
              v-if="showOriginal"
              :src="icon.url"
              class="absolute inset-0 size-full object-contain"
            />
            <!-- 着色层：mask 洗色，实时吃 tintColor -->
            <div v-else class="absolute inset-0" :style="tintStyle(icon.url)" />
          </div>
          <span class="w-full truncate text-center text-xs text-[--gl-6]">{{ icon.name }}</span>
        </div>
      </div>
    </main>

    <!-- 右：颜色选择器面板 -->
    <aside class="w-74 shrink-0 overflow-y-auto border-l border-[--gl-2] p-4">
      <h3 class="mb-2 text-sm font-bold text-[--gl-8]">图标着色</h3>

      <!-- 当前色 swatch + 原图/着色 切换 -->
      <div class="mb-4 flex items-center gap-3">
        <div
          class="size-8 rounded shadow ring-1 ring-black/10"
          :style="{ backgroundColor: tintColor }"
        />
        <label class="flex cursor-pointer items-center gap-2 text-xs text-[--gl-6]">
          <input v-model="showOriginal" type="checkbox" />
          {{ showOriginal ? '原图：关闭 mask 洗色' : '着色：启用 CSS mask 洗色' }}
        </label>
      </div>

      <OklchColorPicker v-model:l="brandL" v-model:c="brandC" v-model:h="brandH" />

      <p class="mt-4 text-xs leading-relaxed text-[--gl-4]">
        原理：图标 PNG 作为容器的
        <code class="px-0.5 bg-[--gl-1]">mask</code>
        ，容器
        <code class="px-0.5 bg-[--gl-1]">background-image</code>
        填充纯色渐变，颜色沿图标 alpha 通道实时渲染成剪影。
      </p>
    </aside>
  </div>
</template>
