import { defineFilter } from './index'

export interface SearchFilterParams {
  /** 搜索关键字；去除首尾空白后为空表示不过滤 */
  keyword: string
}

/** 按点位名称搜索（大小写不敏感的子串匹配） */
export const filterSearch = defineFilter({
  id: 'search',
  name: '名称搜索',
  apply: (input, params: SearchFilterParams) => {
    const keyword = params.keyword.trim().toLowerCase()
    if (!keyword) return [...input]
    return input.filter((marker) => marker.name.toLowerCase().includes(keyword))
  },
})
