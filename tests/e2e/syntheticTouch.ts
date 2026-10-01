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
    const canvas = document.querySelector('[data-slot="stage"] canvas')
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
