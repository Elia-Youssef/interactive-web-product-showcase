import type { Page } from '@playwright/test'
import { ambientMotion } from '../../src/lib/motion/ambientMotion'

// Runs in the page. Only declared ambient effects belong to the capture;
// every other effect keeps its state, time and original settle requirement.
function inspectCaptureMotion({
  selector,
  pin,
  timeMs,
}: {
  selector: string
  pin: boolean
  timeMs: number
}): number {
  let running = 0
  for (const animation of document.getAnimations()) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null
    if (target instanceof Element && target.closest(selector) !== null) {
      if (pin) {
        animation.pause()
        animation.currentTime = timeMs
      }
    } else if (animation.playState === 'running') {
      running += 1
    }
  }
  return running
}

export function runningCaptureMotion(page: Page): Promise<number> {
  return page.evaluate(inspectCaptureMotion, {
    selector: ambientMotion.selector,
    pin: false,
    timeMs: 0,
  })
}

export async function pinAmbientMotion(page: Page, timeMs = 0): Promise<void> {
  await page.evaluate(inspectCaptureMotion, { selector: ambientMotion.selector, pin: true, timeMs })
  // A pinned animation reaches style and layout through the next frames, so
  // a read that follows sees the pinned time, not the last running one.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
}
