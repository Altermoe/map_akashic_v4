import type { Deck, OrthographicView, View } from 'deck.gl'
import { GenshinLayer } from '../types'

export const removeLayerFrom = (
  deck: Deck<OrthographicView>,
  index: number,
  layer: GenshinLayer | null,
) => {
  if (!layer) return
  const copyLayers = [...(deck.props.layers ?? [])]
  copyLayers[index] = null
  deck.setProps({ layers: copyLayers })
}

export const addLayerFrom = (deck: Deck<OrthographicView>, index: number, layer: GenshinLayer) => {
  const copyLayers = [...(deck.props.layers ?? [])]
  const sameIdIndex = copyLayers.findIndex((item) => {
    if (!item) return false
    if (Array.isArray(item)) return false
    return item.id === layer.id
  })
  if (sameIdIndex > -1) {
    copyLayers[sameIdIndex] = null
  }
  copyLayers[index] = layer
  deck.setProps({ layers: copyLayers })
}

export const onReady = <V extends View, T extends Deck<V>>(
  deck: T,
  inject?: {
    onSchedulerUpdate?: (rIC: number) => void
  },
) => {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (deck.isInitialized) {
        resolve()
        return
      }
      const rIC = requestIdleCallback(check)
      inject?.onSchedulerUpdate?.(rIC)
    }
    const rIC = requestIdleCallback(check)
    inject?.onSchedulerUpdate?.(rIC)
  })
}
