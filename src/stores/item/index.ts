import { useRequest } from 'alova/client'
import { defineStore } from 'pinia'
import Api from '@/api'
import { type ItemVo } from '@/api/services/main/globals'

const EMPTY_ITEM_LIST: ItemVo[] = []

export const useItemStore = defineStore('item', () => {
  const { data, loading } = useRequest(Api.main.item_doc.listPageItemByBinary, {
    initialData: EMPTY_ITEM_LIST,
    immediate: true,
  })

  return {
    loading,
    list: data,
  }
})
