<script lang="ts" setup>
import { useIconStore } from '@/stores'

const iconStore = useIconStore()

const containerRef = ref<HTMLDivElement | null>(null)
const imgUrl = ref('')

const canvasSize = reactive({ width: 0, height: 0 })
const containerSize = reactive({ width: 0, height: 0 })

const scale = computed(() => {
  const { width: cw, height: ch } = canvasSize
  const { width: bw, height: bh } = containerSize
  if (!cw || !ch || !bw || !bh) return 1
  return Math.min(bw / cw, bh / ch, 1)
})

const updateContainerSize = () => {
  const el = containerRef.value
  if (!el) return
  containerSize.width = el.clientWidth
  containerSize.height = el.clientHeight
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  updateContainerSize()
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateContainerSize)
    resizeObserver.observe(containerRef.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (imgUrl.value) {
    URL.revokeObjectURL(imgUrl.value)
    imgUrl.value = ''
  }
})

watch(
  () => iconStore.texture,
  async (texture) => {
    if (!texture) {
      if (imgUrl.value) {
        URL.revokeObjectURL(imgUrl.value)
        imgUrl.value = ''
      }
      return
    }
    const bmp = await createImageBitmap(texture)
    canvasSize.width = bmp.width
    canvasSize.height = bmp.height
    const canvas = new OffscreenCanvas(bmp.width, bmp.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const prev = imgUrl.value
    imgUrl.value = URL.createObjectURL(blob)
    if (prev) URL.revokeObjectURL(prev)
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full h-full overflow-hidden flex items-center justify-center"
  >
    <img
      v-if="imgUrl"
      :src="imgUrl"
      class="origin-center max-w-none"
      :style="{ transform: `scale(${scale})` }"
    />
    <div
      v-if="iconStore.rendering"
      class="absolute left-1/2 bottom-4 -translate-x-1/2 min-w-[240px] px-3 py-2 rounded bg-black/60 text-white text-xs"
    >
      <div class="flex justify-between mb-1">
        <span>{{ iconStore.progressMessage }}</span>
        <span>{{ iconStore.progressValue }}%</span>
      </div>
      <div class="h-1 w-full bg-white/20 rounded overflow-hidden">
        <div
          class="h-full bg-white transition-all"
          :style="{ width: `${iconStore.progressValue}%` }"
        />
      </div>
    </div>
  </div>
</template>
