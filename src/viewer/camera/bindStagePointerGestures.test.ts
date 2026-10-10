import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StagePointerGestures } from '@lib/input/StagePointerGestures'
import { stageKeyAction } from '@lib/camera/keyMap'
import { bindStagePointerGestures } from './bindStagePointerGestures'

class PointerInput extends Event {
  readonly pointerId = 1
  readonly clientY = 30
  readonly isPrimary = true
  readonly button = 0

  constructor(
    type: string,
    readonly clientX = 20,
    private readonly nativeTarget: EventTarget | null = null,
  ) {
    super(type, { cancelable: true })
  }

  override get target(): EventTarget | null {
    return this.nativeTarget ?? super.target
  }
}

beforeEach(() => vi.stubGlobal('PointerEvent', PointerInput))
afterEach(() => vi.unstubAllGlobals())

function setup() {
  const ownerDocument = new EventTarget()
  const canvas = Object.assign(new EventTarget(), { ownerDocument })
  const gestures = new StagePointerGestures()
  const focus = vi.fn()
  const drag = vi.fn()
  canvas.addEventListener('pointerdown', drag)
  const release = bindStagePointerGestures(canvas, { focus }, gestures)
  return { ownerDocument, canvas, gestures, focus, drag, release }
}

it('holds native focus until classification without blocking the camera pointer listener', () => {
  const { ownerDocument, canvas, focus, drag } = setup()
  const down = new PointerInput('pointerdown')
  canvas.dispatchEvent(down)
  expect(down.defaultPrevented).toBe(true)
  expect(drag).toHaveBeenCalledExactlyOnceWith(down)
  expect(focus).not.toHaveBeenCalled()
  ownerDocument.dispatchEvent(new PointerInput('pointermove', 21))
  expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true, focusVisible: false })
  ownerDocument.dispatchEvent(new PointerInput('pointerup', 21))
  expect(focus).toHaveBeenCalledTimes(1)
})

it('retires the native listeners and the pending pointer with the canvas life', () => {
  const { ownerDocument, canvas, focus, drag, release } = setup()
  canvas.dispatchEvent(new PointerInput('pointerdown'))
  release()
  ownerDocument.dispatchEvent(new PointerInput('pointermove', 21))
  ownerDocument.dispatchEvent(new PointerInput('pointerup', 21))
  const retired = new PointerInput('pointerdown')
  canvas.dispatchEvent(retired)
  expect(retired.defaultPrevented).toBe(false)
  expect(focus).not.toHaveBeenCalled()
  expect(drag).toHaveBeenCalledTimes(2)
})

it('routes native pointer cancellation through the same gesture owner', () => {
  const { ownerDocument, canvas, gestures, focus } = setup()
  const dismiss = vi.fn()
  gestures.consumePressWith(dismiss)
  canvas.dispatchEvent(new PointerInput('pointerdown'))
  ownerDocument.dispatchEvent(new PointerInput('pointercancel'))
  ownerDocument.dispatchEvent(new PointerInput('pointermove', 21))
  ownerDocument.dispatchEvent(new PointerInput('pointerup'))
  expect(focus).not.toHaveBeenCalled()
  expect(dismiss).not.toHaveBeenCalled()
})

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])('card=%s drag=%s leaves keyboard continuation with the decided owner', (card, drag) => {
  const ownerDocument = new EventTarget()
  const canvas = Object.assign(new EventTarget(), { ownerDocument })
  const opener = new EventTarget()
  const keys = new EventTarget()
  let focused: EventTarget = opener
  const turn = vi.fn()
  const continueAtOpener = vi.fn()
  keys.addEventListener('keydown', () =>
    turn(
      stageKeyAction({
        key: 'ArrowRight',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
      }),
    ),
  )
  opener.addEventListener('keydown', continueAtOpener)
  const gestures = new StagePointerGestures()
  const focus = vi.fn(() => {
    focused = keys
  })
  bindStagePointerGestures(canvas, { focus }, gestures)
  const dismiss = vi.fn(() => {
    focused = opener
  })
  if (card) gestures.consumePressWith(dismiss)
  canvas.dispatchEvent(new PointerInput('pointerdown'))
  expect(focused).toBe(opener)
  if (drag) ownerDocument.dispatchEvent(new PointerInput('pointermove', 21))
  ownerDocument.dispatchEvent(new PointerInput('pointerup', drag ? 21 : 20, canvas))
  const stageOwns = !card || drag
  expect(focused).toBe(stageOwns ? keys : opener)
  focused.dispatchEvent(new Event('keydown'))
  expect(turn).toHaveBeenCalledTimes(stageOwns ? 1 : 0)
  expect(continueAtOpener).toHaveBeenCalledTimes(stageOwns ? 0 : 1)
  if (stageOwns)
    expect(turn).toHaveBeenCalledWith({ kind: 'rotate', direction: 'right', size: 'coarse' })
  expect(focus).toHaveBeenCalledTimes(stageOwns ? 1 : 0)
  expect(dismiss).toHaveBeenCalledTimes(card && !drag ? 1 : 0)
})
