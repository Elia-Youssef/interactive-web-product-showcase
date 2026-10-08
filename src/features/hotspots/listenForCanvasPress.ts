// A stationary primary press on this stage's canvas dismisses the card.
// Any pointer travel cancels the press, so orbit drags retain the card.
// Overlay controls, docked content and another stage never qualify.
export function listenForCanvasPress(surface: HTMLElement, dismiss: () => void): () => void {
  let press: { readonly id: number; readonly x: number; readonly y: number } | null = null
  const owner = surface.ownerDocument
  const isCanvas = (target: EventTarget | null) =>
    target instanceof HTMLCanvasElement && surface.contains(target)

  const down = (event: PointerEvent) => {
    press =
      event.isPrimary && event.button === 0 && isCanvas(event.target)
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : null
  }
  const move = (event: PointerEvent) => {
    if (press?.id === event.pointerId && (press.x !== event.clientX || press.y !== event.clientY)) {
      press = null
    }
  }
  const cancel = () => {
    press = null
  }
  const up = (event: PointerEvent) => {
    const started = press
    press = null
    if (
      started !== null &&
      started.id === event.pointerId &&
      started.x === event.clientX &&
      started.y === event.clientY &&
      isCanvas(event.target)
    ) {
      dismiss()
    }
  }

  owner.addEventListener('pointerdown', down, true)
  owner.addEventListener('pointermove', move, true)
  owner.addEventListener('pointerup', up, true)
  owner.addEventListener('pointercancel', cancel, true)
  return () => {
    owner.removeEventListener('pointerdown', down, true)
    owner.removeEventListener('pointermove', move, true)
    owner.removeEventListener('pointerup', up, true)
    owner.removeEventListener('pointercancel', cancel, true)
  }
}
