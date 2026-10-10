import type { StagePointerGestures } from '@lib/input/StagePointerGestures'

type CanvasTarget = EventTarget & { readonly ownerDocument: EventTarget }
type FocusTarget = { readonly focus: (options: FocusOptions) => void }

// Native pointer focus waits for the gesture's classification. The camera's
// drag listener still receives every event, while preventing the down
// default keeps a pending dismissal's current focus holder intact.
export function bindStagePointerGestures(
  canvas: CanvasTarget,
  target: FocusTarget,
  gestures: StagePointerGestures,
): () => void {
  const releaseFocus = gestures.focusWith(() =>
    target.focus({ preventScroll: true, focusVisible: false }),
  )
  const down = (event: Event) => {
    event.preventDefault()
    gestures.down(pointerInput(event))
  }
  const move = (event: Event) => gestures.move(pointerInput(event))
  const up = (event: Event) => gestures.up(pointerInput(event), event.target === canvas)
  const cancel = (event: Event) => gestures.cancel(pointerInput(event).pointerId)
  const owner = canvas.ownerDocument
  canvas.addEventListener('pointerdown', down)
  owner.addEventListener('pointermove', move, true)
  owner.addEventListener('pointerup', up, true)
  owner.addEventListener('pointercancel', cancel, true)
  return () => {
    canvas.removeEventListener('pointerdown', down)
    owner.removeEventListener('pointermove', move, true)
    owner.removeEventListener('pointerup', up, true)
    owner.removeEventListener('pointercancel', cancel, true)
    releaseFocus()
  }
}

function pointerInput(event: Event): PointerEvent {
  if (!(event instanceof PointerEvent)) throw new Error('a canvas gesture requires a pointer event')
  return event
}
