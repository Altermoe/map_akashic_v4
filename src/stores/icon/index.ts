import { useObjectUrl } from '@vueuse/core'
import { useRequest } from 'alova/client'
import { defineStore } from 'pinia'
import { acceptHMRUpdate } from 'pinia'
import Api from '@/api'
import type { IconVo } from '@/api/services/main/globals'
import markerContainerIconUrl from '@/assets/marker-container.png?url'
import markerOverlayPinIconUrl from '@/assets/marker-overlay-pin.png?url'
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
export const enum IconState {
  DEFAULT = 0b001,
  OVERLAY = 0b010,
}
export const ICON_STATE: { key: string; url: string; bit: number }[] = [
  {
    key: 'default',
    url: markerContainerIconUrl,
    bit: IconState.DEFAULT,
  },
  {
    key: 'overlay',
    url: markerOverlayPinIconUrl,
    bit: IconState.OVERLAY,
  },
]

const generateCacheKey = (
  iconList: { id: number; url: string }[],
  state: { key: string; url: string }[],
) => {
  const sortedIconList = [...iconList].sort((a, b) => a.id - b.id)
  const sortedState = [...state].sort((a, b) => a.key.localeCompare(b.key))
  const keyData = { icons: sortedIconList, state: sortedState }
  return JSON.stringify(keyData)
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

  const cacheKey = generateCacheKey(sendList, ICON_STATE)
  const dbKey = `${CACHE_NAMESPACE}:${cacheKey}`

  try {
    const cached = await db.kv.get(dbKey)
    if (cached) {
      const { textureBlob, mapping } = cached.value as CachedRenderResult
      return { texture: textureBlob, mapping }
    }
  } catch {}

  const res = await invokeWorker<RenderRequest, RenderResult>(
    worker,
    {
      data: sendList,
      state: ICON_STATE,
    },
    { onProgress },
  )

  try {
    const cachedResult: CachedRenderResult = {
      textureBlob: res.texture,
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
  const texture = shallowRef<Blob | null>(null)
  const mapping = shallowRef<IconMapping>({})

  const textureUrl = useObjectUrl(texture)

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
    textureUrl,
    mapping,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useIconStore, import.meta.hot))
}
