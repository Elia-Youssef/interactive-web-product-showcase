import type { Page } from '@playwright/test'

// The page-side driver of a per-frame drag: it delivers one pointer step
// per rendering phase, posted from a task that runs just after each
// phase's render, so every presented frame is followed by exactly one
// dispatched step and the next frame applies it, whatever order the page's
// own callbacks and the stage's render loop registered in. The steps are
// synthetic pointer events on the canvas, which camera-controls handles
// like real ones: the same pointerdown registration, the same per-step
// dragging application and the same move-start events.

// The driver state the install leaves on the window. Test-only.
type DragDriverState = {
  dispatchTimesMs: number[]
  // The stage's frame count at each move's dispatch: the move applies at
  // the very next rendered frame, which the frame recorder labels with the
  // same counter.
  appliedAtFrames: number[]
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
  const { startX, dxPerFrame } = options
  if (window.__perFrameDrag !== undefined || window.__dragDispatch === undefined) {
    throw new Error('the drag driver needs its dispatch helper and a free window')
  }
  const dispatch = window.__dragDispatch
  let running = true
  let started = false
  const state: DragDriverState = {
    dispatchTimesMs: window.__dragTimes ?? [],
    appliedAtFrames: [],
    moveCount: 0,
    stop: (): void => {
      running = false
      dispatch('pointerup', 0, startX + state.moveCount * dxPerFrame)
    },
  }
  const tick = (): void => {
    if (!running) {
      return
    }
    // Re-register before dispatching: the down's invalidation makes the
    // stage's render loop register for the next phase, and the driver must
    // stay ahead of it in every phase's callback order.
    requestAnimationFrame(tick)
    const type = started ? 'pointermove' : 'pointerdown'
    if (type === 'pointermove') {
      state.appliedAtFrames.push(window.__viewer?.renderedFrames ?? -1)
    }
    dispatch(type, 1, startX + state.moveCount * dxPerFrame)
    started = true
    if (type === 'pointermove') {
      state.moveCount += 1
    }
  }
  window.__perFrameDrag = state
  requestAnimationFrame(tick)
}

// Installs the driver.
export async function installPerFrameDragDriver(
  page: Page,
  options: PerFrameDragOptions,
): Promise<void> {
  await page.evaluate(dragDispatchBootstrap, options)
  await page.evaluate(dragLoopBootstrap, options)
}

// Stops the driver and hands the dispatch times and the move count back.
export async function stopPerFrameDragDriver(page: Page): Promise<{
  readonly dispatchTimesMs: readonly number[]
  readonly appliedAtFrames: readonly number[]
  readonly moveCount: number
}> {
  const result = await page.evaluate(() => {
    const driver = window.__perFrameDrag
    if (driver === undefined) {
      throw new Error('the per-frame drag driver is not installed')
    }
    driver.stop()
    const dispatchTimesMs = [...(window.__dragTimes ?? [])]
    const appliedAtFrames = [...driver.appliedAtFrames]
    const moveCount = driver.moveCount
    return { dispatchTimesMs, appliedAtFrames, moveCount }
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
