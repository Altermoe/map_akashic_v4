import { useRequest } from 'alova/client'
import { defineStore } from 'pinia'
import { acceptHMRUpdate } from 'pinia'
import Api from '@/api'
import type { IconVo } from '@/api/services/main/globals'
import markerContainerIconUrl from '@/assets/marker-container.png?url'
import { db } from '@/database'
import { invokeWorker } from '@/utils/worker'
import type { RenderRequest, RenderResult, IconMapping } from './render.worker'
// oxlint-disable-next-line import/default
import RenderWorker from './render.worker?worker'

let worker: Worker | null = null

interface CachedRenderResult {
  textureBlob: Blob
  mapping: IconMapping
}

const CACHE_NAMESPACE = 'icon-render'

const generateCacheKey = (
  iconList: { id: number; url: string }[],
  state: { key: string; url: string }[],
) => {
  const sortedIconList = [...iconList].sort((a, b) => a.id - b.id)
  const sortedState = [...state].sort((a, b) => a.key.localeCompare(b.key))
  const keyData = { icons: sortedIconList, state: sortedState }
  return JSON.stringify(keyData)
}

const imageBitmapToBlob = async (bitmap: ImageBitmap): Promise<Blob> => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  return canvas.convertToBlob({ type: 'image/png' })
}

const blobToImageBitmap = async (blob: Blob): Promise<ImageBitmap> => {
  return createImageBitmap(blob)
}

const render = async (
  iconList: IconVo[],
  onProgress?: (value: number, message?: string) => void,
) => {
  if (!worker) {
    worker = new RenderWorker({ name: 'markerTextureRender' })
  }
  const sendList: { id: number; url: string }[] = []
  const { length } = iconList
  for (let i = 0; i < length; i++) {
    const { id, url } = iconList[i]
    if (id === undefined || !url) continue
    sendList.push({ id, url })
  }
  const state = [
    {
      key: 'default',
      url: markerContainerIconUrl,
    },
  ]

  const cacheKey = generateCacheKey(sendList, state)
  const dbKey = `${CACHE_NAMESPACE}:${cacheKey}`

  try {
    const cached = await db.kv.get(dbKey)
    if (cached) {
      const { textureBlob, mapping } = cached.value as CachedRenderResult
      const texture = await blobToImageBitmap(textureBlob)
      return { texture, mapping }
    }
  } catch {}

  const res = await invokeWorker<RenderRequest, RenderResult>(
    worker,
    {
      data: sendList,
      state,
    },
    { onProgress },
  )

  try {
    const textureBlob = await imageBitmapToBlob(res.texture)
    const cachedResult: CachedRenderResult = {
      textureBlob,
      mapping: res.mapping,
    }
    await db.kv.put(
      {
        key: dbKey,
        value: cachedResult,
        namespace: CACHE_NAMESPACE,
      },
      dbKey,
    )
  } catch {}

  return res
}

export const useIconStore = defineStore('icon', () => {
  const { data: iconList, loading: iconListLoading } = useRequest(
    Api.main.icon_doc.listAllIconBinary(),
    {
      initialData: [],
    },
  )

  const iconIdMap = computed(() => {
    const map = new Map<number | undefined, IconVo>()
    const { length } = iconList.value
    for (let i = 0; i < length; i++) {
      const icon = iconList.value[i]
      map.set(icon.id, icon)
    }
    return map
  })

  const rendering = ref(false)
  const progressValue = ref(0)
  const progressMessage = ref('')
  const texture = ref<ImageBitmap | null>(null)
  const mapping = ref<IconMapping | null>(null)

  const runRender = async () => {
    rendering.value = true
    progressValue.value = 0
    progressMessage.value = '开始渲染'
    try {
      const res = await render(toRaw(iconList.value), (value, message) => {
        progressValue.value = value
        if (message) progressMessage.value = message
      })
      texture.value = res.texture
      mapping.value = res.mapping
    } finally {
      rendering.value = false
    }
  }

  // 图标列表变化时自动触发渲染
  watch(
    () => toRaw(iconList.value),
    () => {
      runRender()
    },
  )

  return {
    list: computed(() => toRaw(iconList.value)),
    idMap: iconIdMap,
    loading: computed(() => iconListLoading.value),
    rendering,
    progressValue,
    progressMessage,
    texture,
    mapping,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useIconStore, import.meta.hot))
}
