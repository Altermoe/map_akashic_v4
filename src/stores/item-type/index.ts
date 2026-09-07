import { useRequest } from 'alova/client'
import { defineStore } from 'pinia'
import Api from '@/api'
import type { ItemTypeVo } from '@/api/services/main/globals'

const EMPTY_ITEM_TYPE_LIST: ItemTypeVo[] = []

export const useItemTypeStore = defineStore('item-type', () => {
  const { data, loading } = useRequest(
    Api.main.item_type.listItemType({
      transform: (data) => data.data ?? [],
    }),
    {
      initialData: EMPTY_ITEM_TYPE_LIST,
      immediate: true,
    },
  )

  const idMap = computed(() => {
    const list = data.value
    const { length } = list
    const map = new Map<number | undefined, ItemTypeVo>()
    for (let i = 0; i < length; i++) {
      const itemType = list[i]
      map.set(itemType.id, itemType)
    }
    return map
  })

  return {
    loading,
    list: data,
    idMap,
  }
})
