import { useWatcher } from 'alova/client'
import Api from '@/api'
import type { ItemSearchVo } from '@/api/services/main/globals'

/**
 * 按地区加载物品列表（含类型信息），供默认筛选器的已选 chip 与添加物品弹层共用。
 * 地区为空时不发起请求（返回空列表）；alova restore 缓存 1h。
 */
export const useAreaItems = (getAreaIdList: () => number[] | undefined) => {
  const { data: items, loading } = useWatcher(
    () =>
      Api.main.item.listItemIdByType({
        cacheFor: { mode: 'restore', expire: 60 * 60 * 1000 },
        data: {
          typeIdList: [],
          areaIdList: getAreaIdList() ?? [],
          size: 300,
          sort: ['sortIndex-'],
        },
        transform: (res) => res.data?.record ?? [],
      }),
    [getAreaIdList],
    {
      initialData: [],
      abortLast: true,
      immediate: false,
      middleware: ({ method }, next) => {
        if (!(method.data as ItemSearchVo)?.areaIdList?.length) return
        next()
      },
    },
  )
  return { items, loading }
}
