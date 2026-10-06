import type { Page } from '@playwright/test'

// A finite per-frame drag holds its pointer down after the last step, so
// the recorder can acknowledge the final applied frame before release
// changes the camera's damping. Every move advances the pointer once.

// The driver state the install leaves on the window. Test-only.
type DragDriverState = {
  dispatchTimesMs: number[]
  // The stage's frame count at each move's dispatch: the move applies at
  // the very next rendered frame, which the frame recorder labels with the
  // same counter.
  dispatchedAtFrames: number[]
  moveCount: number
  stop(): void
}

declare global {
  interface Window {
    __perFrameDrag?: DragDriverState
    __dragDispatch?: (type: string, buttons: number, x: number) => void
    __dragTimes?: number[]
  }
}

export type PerFrameDragOptions = {
  // The pointer id the synthetic drag carries.
  readonly pointerId: number
  // The pointerdown position, in page coordinates.
  readonly startX: number
  readonly startY: number
  // The pointer step along x, one per rendering phase.
  readonly dxPerFrame: number
  // Stop sending moves at this count, holding the pointer until stop.
  readonly moveLimit: number
}

// The dispatch half of the page-side driver, self-contained for
// page.evaluate: one synthetic pointer event on the stage canvas per call,
// each dispatch time recorded on the window.
function dragDispatchBootstrap(options: PerFrameDragOptions): void {
  const { pointerId, startY } = options
  const canvas = document.querySelector('[data-slot="stage"] canvas')
  if (canvas === null) {
    throw new Error('the stage canvas must exist for the drag driver')
  }
  const times: number[] = []
  window.__dragTimes = times
  window.__dragDispatch = (type, buttons, x) => {
    const event = new PointerEvent(type, {
      pointerId,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: x,
      clientY: startY,
      buttons,
      bubbles: true,
      cancelable: true,
    })
    canvas.dispatchEvent(event)
    times.push(performance.now())
  }
}

// The loop half of the page-side driver, self-contained for
// page.evaluate: from its own rAF callback, which the stage's render loop
// registers after, it presses the pointer down once, then moves it one
// dxPerFrame step per phase before that phase's camera update; stop
// dispatches the pointerup. The stage must be idle at the install, so the
// driver's callback registers ahead of the stage's and keeps that order.
function dragLoopBootstrap(options: PerFrameDragOptions): void {
  const { startX, dxPerFrame, moveLimit } = options
  if (window.__perFrameDrag !== undefined || window.__dragDispatch === undefined) {
    throw new Error('the drag driver needs its dispatch helper and a free window')
  }
  const dispatch = window.__dragDispatch
  let running = true
  let started = false
  const state: DragDriverState = {
    dispatchTimesMs: window.__dragTimes ?? [],
    dispatchedAtFrames: [],
    moveCount: 0,
    stop: (): void => {
      running = false
      dispatch('pointerup', 0, startX + state.moveCount * dxPerFrame)
    },
  }
  const tick = (): void => {
    if (!running || state.moveCount === moveLimit) {
      return
    }
    // Re-register before dispatching: the down's invalidation makes the
    // stage's render loop register for the next phase, and the driver must
    // stay ahead of it in every phase's callback order.
    requestAnimationFrame(tick)
    const type = started ? 'pointermove' : 'pointerdown'
    if (type === 'pointermove') {
      state.dispatchedAtFrames.push(window.__viewer?.renderedFrames ?? -1)
      state.moveCount += 1
    }
    dispatch(type, 1, startX + state.moveCount * dxPerFrame)
    started = true
  }
  window.__perFrameDrag = state
  requestAnimationFrame(tick)
}

// Installs the driver.
export async function installPerFrameDragDriver(
  page: Page,
  options: PerFrameDragOptions,
): Promise<void> {
  if (!Number.isSafeInteger(options.moveLimit) || options.moveLimit < 1) {
    throw new Error('the drag move limit must be a positive safe integer')
  }
  await page.evaluate(dragDispatchBootstrap, options)
  await page.evaluate(dragLoopBootstrap, options)
}

// Stops the driver and hands the dispatch times and the move count back.
export async function stopPerFrameDragDriver(page: Page): Promise<{
  readonly dispatchTimesMs: readonly number[]
  readonly dispatchedAtFrames: readonly number[]
  readonly moveCount: number
}> {
  const result = await page.evaluate(() => {
    const driver = window.__perFrameDrag
    if (driver === undefined) {
      throw new Error('the per-frame drag driver is not installed')
    }
    driver.stop()
    const dispatchTimesMs = [...(window.__dragTimes ?? [])]
    const dispatchedAtFrames = [...driver.dispatchedAtFrames]
    const moveCount = driver.moveCount
    return { dispatchTimesMs, dispatchedAtFrames, moveCount }
  })
  await page.evaluate(() => {
    delete window.__perFrameDrag
    delete window.__dragDispatch
    delete window.__dragTimes
  })
  return result
}

// How many moves the driver has dispatched so far, for the polls.
export function dispatchedMoves(page: Page): Promise<number> {
  return page.evaluate(() => window.__perFrameDrag?.moveCount ?? -1)
}

// Only a recorded frame strictly after dispatch acknowledges an applied
// move. A finite driver keeps dragging active while the caller polls this
// boundary, then stops the recorder before releasing the pointer.
export function recordedDragMoves(page: Page): Promise<number> {
  return page.evaluate(() => {
    const driver = window.__perFrameDrag
    const recorder = window.__moveRecorder
    if (driver === undefined || recorder === undefined) {
      throw new Error('the drag driver and camera recorder must both be installed')
    }
    const recordedFrame = recorder.records.at(-1)?.frames ?? -1
    return driver.dispatchedAtFrames.filter((frame) => frame < recordedFrame).length
  })
}
