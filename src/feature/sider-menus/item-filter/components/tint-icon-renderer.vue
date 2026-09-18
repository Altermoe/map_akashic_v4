<script setup lang="ts">
import type { AreaVo, IconVo } from '@/api/services/main/globals'
import Unknown from '@/assets/area/Unknown.png'
import { BUILTIN_CHILD_FALLBACK, BUILTIN_ROOT_FALLBACK } from '@/stores/area/config'

const props = defineProps<{
  area: AreaVo
  areaIdMap: Map<number | undefined, AreaVo>
  iconIdMap: Map<number | undefined, IconVo>
}>()

const icon = computed(() => {
  // 优先级 0: 自身的图标
  const defaultIconUrl = props.iconIdMap?.get(props.area.iconId)?.url
  if (defaultIconUrl) {
    return { error: false, url: defaultIconUrl, message: 'valid default icon' }
  }

  const { code } = props.area
  if (!code) {
    return { error: true, url: '', message: 'area code is empty' }
  }

  // 优先级 1: 自身的回退图标
  const builtinFallback = code.startsWith('C:')
    ? BUILTIN_ROOT_FALLBACK.get(code)
    : code.startsWith('A:')
      ? BUILTIN_CHILD_FALLBACK.get(code)
      : undefined
  if (builtinFallback) {
    return { error: false, url: builtinFallback, message: 'fallback to builtin icon' }
  }

  const { parentId } = props.area
  const parent = props.areaIdMap.get(parentId)
  if (!parent?.code) {
    return { error: true, url: Unknown, message: 'parent area is empty' }
  }

  // 优先级 2: 父级地区自身的图标
  const parentIconUrl = props.iconIdMap.get(parent.iconId)?.url
  if (parentIconUrl) {
    return { error: false, url: parentIconUrl, message: 'fallback to parent icon' }
  }

  // 优先级 3: 父级地区的回退图标
  const parentFallback = BUILTIN_ROOT_FALLBACK.get(parent.code)
  if (parentFallback) {
    return { error: false, url: parentFallback, message: 'fallback to parent builtin icon' }
  }

  return { error: false, url: Unknown, message: 'all fallback failed' }
})
</script>

<template>
  <div class="shrink-0">
    <div
      class="w-full h-full bg-contain shrink-0"
      :data-message="icon.message"
      :style="{
        backgroundImage: `url(${icon.url})`,
      }"
    />
  </div>
</template>
