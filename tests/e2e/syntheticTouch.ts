import type { Page } from '@playwright/test'

// The synthesized touch driver. Playwright has no multi-touch API, so the
// touch specs drive the controls with synthesized pointer events carrying
// pointerType 'touch' and two pointer ids. The controls listen for
// pointerdown on the canvas and for pointermove and pointerup on the
// document, so the phase picks the event target.

export type TouchPoint = { readonly x: number; readonly y: number }

type PointerEventInit = {
  readonly phase: 'pointerdown' | 'pointermove' | 'pointerup'
  readonly pointerId: number
  readonly x: number
  readonly y: number
}

async function dispatchTouchPointer(page: Page, event: PointerEventInit): Promise<void> {
  await page.evaluate((probe) => {
    // Both the app and the harness own one stage canvas.
    const canvas = document.querySelector('canvas')
    if (canvas === null) {
      throw new Error('the stage canvas is missing')
    }
    const synthesized = new PointerEvent(probe.phase, {
      pointerId: probe.pointerId,
      pointerType: 'touch',
      isPrimary: probe.pointerId === 0,
      clientX: probe.x,
      clientY: probe.y,
      movementX: 0,
      movementY: 0,
      buttons: probe.phase === 'pointerup' ? 0 : 1,
      bubbles: true,
      cancelable: true,
    })
    const target = probe.phase === 'pointerdown' ? canvas : document
    target.dispatchEvent(synthesized)
  }, event)
}

// One finger pressed at `from` and dragged to `to` in steps, then lifted.
export async function touchDrag(
  page: Page,
  pointerId: number,
  from: TouchPoint,
  to: TouchPoint,
  steps = 8,
): Promise<void> {
  await dispatchTouchPointer(page, { phase: 'pointerdown', pointerId, x: from.x, y: from.y })
  for (let step = 1; step <= steps; step += 1) {
    await dispatchTouchPointer(page, {
      phase: 'pointermove',
      pointerId,
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    })
  }
  await dispatchTouchPointer(page, { phase: 'pointerup', pointerId, x: to.x, y: to.y })
}

// Two fingers pressed `span` apart around `center` and pinched outward
// (positive spread) or inward (negative), both fingers moving together.
export async function touchPinch(
  page: Page,
  center: TouchPoint,
  span: number,
  spread: number,
  steps = 8,
): Promise<void> {
  await dispatchTouchPointer(page, {
    phase: 'pointerdown',
    pointerId: 0,
    x: center.x - span / 2,
    y: center.y,
  })
  await dispatchTouchPointer(page, {
    phase: 'pointerdown',
    pointerId: 1,
    x: center.x + span / 2,
    y: center.y,
  })
  for (let step = 1; step <= steps; step += 1) {
    const width = span / 2 + (spread * step) / steps
    await dispatchTouchPointer(page, {
      phase: 'pointermove',
      pointerId: 0,
      x: center.x - width,
      y: center.y,
    })
    await dispatchTouchPointer(page, {
      phase: 'pointermove',
      pointerId: 1,
      x: center.x + width,
      y: center.y,
    })
  }
  await dispatchTouchPointer(page, {
    phase: 'pointerup',
    pointerId: 0,
    x: center.x - span / 2 - spread,
    y: center.y,
  })
  await dispatchTouchPointer(page, {
    phase: 'pointerup',
    pointerId: 1,
    x: center.x + span / 2 + spread,
    y: center.y,
  })
}

// The page-side state of one sweep, keyed under window so the Node side can
// read its progress and stop it. Nothing else writes this key.
type SweepState = {
  moves: number
  stopped: boolean
  lastX: number
  lastY: number
}

declare global {
  interface Window {
    __touchSweep?: SweepState
  }
}

// The in-page half of the sweep: it installs the state, fires one move per
// animation frame, and parks itself once the state is stopped or gone. It
// runs in the page, so it sees no Node state.
function installTouchSweep(probe: {
  readonly pointerId: number
  readonly start: TouchPoint
  readonly sweepWidth: number
}): void {
  const { pointerId, start, sweepWidth } = probe
  const state: SweepState = { moves: 0, stopped: false, lastX: start.x, lastY: start.y }
  window.__touchSweep = state
  const fire = (phase: 'pointermove' | 'pointerup', x: number, y: number): void => {
    document.dispatchEvent(
      new PointerEvent(phase, {
        pointerId,
        pointerType: 'touch',
        isPrimary: pointerId === 0,
        clientX: x,
        clientY: y,
        movementX: 0,
        movementY: 0,
        buttons: phase === 'pointerup' ? 0 : 1,
        bubbles: true,
        cancelable: true,
      }),
    )
  }
  const step = (): void => {
    const sweep = window.__touchSweep
    if (sweep === undefined || sweep.stopped) {
      return
    }
    const cycle = sweepWidth * 2
    const offset = ((sweep.moves * 20) % cycle) - sweepWidth
    sweep.lastX = start.x + offset
    fire('pointermove', sweep.lastX, start.y)
    sweep.moves += 1
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// A continuous one-finger drag: the pointer sweeps from `at` back and forth
// across `sweepWidth` pixels, one move per animation frame, until stopped.
// The moves are dispatched inside the page precisely because a drag that
// must survive Node-side work (clicks, reads) cannot be paced from Node:
// each round trip there is longer than a frame, and the drag would pause in
// every gap. stop lifts the pointer where it stands.
export async function startTouchSweep(
  page: Page,
  pointerId: number,
  at: TouchPoint,
  sweepWidth: number,
): Promise<{ moves: () => Promise<number>; stop: () => Promise<void> }> {
  await dispatchTouchPointer(page, { phase: 'pointerdown', pointerId, x: at.x, y: at.y })
  await page.evaluate(installTouchSweep, { pointerId, start: at, sweepWidth })
  return {
    moves: async () =>
      page.evaluate(() => {
        const sweep = window.__touchSweep
        if (sweep === undefined) {
          throw new Error('the touch sweep is not running')
        }
        return sweep.moves
      }),
    stop: async () => {
      const last = await page.evaluate(() => {
        const sweep = window.__touchSweep
        if (sweep === undefined) {
          throw new Error('the touch sweep is not running')
        }
        sweep.stopped = true
        return { x: sweep.lastX, y: sweep.lastY }
      })
      await dispatchTouchPointer(page, {
        phase: 'pointerup',
        pointerId,
        x: last.x,
        y: last.y,
      })
      await page.evaluate(() => {
        delete window.__touchSweep
      })
    },
  }
}
