import { Deck } from 'deck.gl'
import type { DeckProps, OrthographicView, OrthographicViewState } from 'deck.gl'

export class GenshinDeck extends Deck<OrthographicView> {
  getLiveViewState(): OrthographicViewState | null {
    const viewManager = this.viewManager
    if (!viewManager) return null
    const view = viewManager.views[0]
    if (!view) return null
    return viewManager.getViewState(view) as OrthographicViewState
  }
}

export interface GenshinDeckProps extends DeckProps<OrthographicView> {}
