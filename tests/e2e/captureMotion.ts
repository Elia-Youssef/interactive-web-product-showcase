import type { Page } from '@playwright/test'
import { ambientMotion } from '../../src/lib/motion/ambientMotion'

// Runs in the page. Only declared ambient effects belong to the capture;
// every other effect keeps its state, time and original settle requirement.
function inspectCaptureMotion({ selector, pin }: { selector: string; pin: boolean }): number {
  let running = 0
  for (const animation of document.getAnimations()) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null
    if (target instanceof Element && target.closest(selector) !== null) {
      if (pin) {
        animation.pause()
        animation.currentTime = 0
      }
    } else if (animation.playState === 'running') {
      running += 1
    }
  }
  return running
}

export function runningCaptureMotion(page: Page): Promise<number> {
  return page.evaluate(inspectCaptureMotion, { selector: ambientMotion.selector, pin: false })
}

export async function pinAmbientMotion(page: Page): Promise<void> {
  await page.evaluate(inspectCaptureMotion, { selector: ambientMotion.selector, pin: true })
}
