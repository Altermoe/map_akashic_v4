import { defineStore } from 'pinia'

/**
 * 筛选状态
 * TODO: 契约设定中
 */
export const useFilterStore = defineStore('filter', () => {
  const loading = ref(false)

  /** 基础点位，经过筛选系统得到 */
  const staticMarkers = shallowRef()

  /** 临时点位，通过其他途径得到 */
  const temporMarkers = shallowRef()

  /** 基于上面两者合并、去重得到 */
  const resultMarkers = computed(() => {
    void staticMarkers.value
    void temporMarkers.value
  })

  /**
   * resultMarkers 作为数据源，经过交互状态合成，计算 mask 并编码为静态二进制数据，由 GenshinMarkerLayer 消费
   *
   * - 此过程可能会异步化
   */
  const renderMarkers = computed(() => {
    void resultMarkers.value
  })

  return {
    loading,
    renderMarkers,
  }
})
