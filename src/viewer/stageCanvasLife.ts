// The life of the stage's canvas, as a pure transition. A canvas whose
// renderer is retired (a present threw inside three's render, which leaves
// the renderer unable to reach the canvas again) keeps standing with the
// failed content on it, so the failed content is never mounted again: a
// fresh canvas would remount it, and a remount is a retry. Only new content,
// a product life that starts after the retirement, gets a fresh canvas, and
// it gets exactly one: the epoch the canvas is keyed by moves once, and the
// new canvas is live.

export type StageCanvasLife = {
  // The key of the canvas mount; a new epoch is a fresh canvas and renderer.
  readonly epoch: number
  readonly renderer: 'live' | 'retired'
}

export type StageCanvasEvent =
  // The renderer of the canvas mounted at this epoch was retired.
  | { readonly kind: 'retired'; readonly epoch: number }
  // A product life started on the stage.
  | { readonly kind: 'content-arrived' }

export const initialStageCanvasLife: StageCanvasLife = { epoch: 0, renderer: 'live' }

export function applyStageCanvasEvent(
  life: StageCanvasLife,
  event: StageCanvasEvent,
): StageCanvasLife {
  switch (event.kind) {
    case 'retired':
      // A canvas already replaced cannot retire the one that replaced it.
      return event.epoch === life.epoch ? { epoch: life.epoch, renderer: 'retired' } : life
    case 'content-arrived':
      return life.renderer === 'retired' ? { epoch: life.epoch + 1, renderer: 'live' } : life
  }
}
