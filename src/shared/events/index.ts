import { fromEvent, share } from 'rxjs'

export const pointerdown$ = fromEvent<PointerEvent>(window, 'pointerdown').pipe(share())
export const pointermove$ = fromEvent<PointerEvent>(window, 'pointermove').pipe(share())
export const pointerup$ = fromEvent<PointerEvent>(window, 'pointerup').pipe(share())
