import { expect, type Locator, type Page } from '@playwright/test'
import { testBodyBudgetMs } from './budgets'
import { settledStage } from './stageSettle'

// The masked stage captures of the suite. The dev HUD shows live timings, so
// it is masked, and it is right-anchored and sized by its content, so a
// capture taken before its rolling window drains masks a different box than
// one taken after. The settled entries own the mask and the wait together:
// the capture happens only once the stage is at rest, which is settledStage
// (it leaves the HUD at its rest text) followed by the end of the page's
// one-time animations, so captures of a run through them cover the same box
// and the same pixels and can be compared. The instant entry serves the
// proofs that count one capture on its own at an observed moment; its
// contract sits on it below.

// The one mask every stage capture carries: the HUD box whose size the
// settled wait pins.
export function devHudMask(page: Page): readonly Locator[] {
  return [page.getByTestId('dev-hud')]
}

// The mask extensions a caller can add to the standard list, a closed set:
// the call site names the extension, this module owns the locators. The
// chrome corners carry bright content of their own over the stage, so a
// count that reads stage pixels masks all of them beside the HUD, and only
// the product can answer.
export type StageCaptureExtension = 'chromeCorners'

const maskExtensions: Readonly<Record<StageCaptureExtension, (page: Page) => Locator>> = {
  chromeCorners: (page) => page.locator('[data-corner]'),
}

// The standard mask plus the named extensions, painted black over the whole
// viewport. The viewport is the extent because Chromium drops a presented
// WebGPU canvas from element and clip captures, and only the plain viewport
// capture carries it.
function maskedViewportCapture(
  page: Page,
  extensions: readonly StageCaptureExtension[],
): Promise<Uint8Array> {
  const extensionMask = extensions.map((extension) => maskExtensions[extension](page))
  return page.screenshot({ mask: [...devHudMask(page), ...extensionMask], maskColor: '#000000' })
}

// The rest every settled capture waits for: the frame settle and the HUD
// drain, then the page's one-time DOM animations, the markers' first-load
// pulse among them. Those run on CSS time, not on frames, so a frame settle
// does not cover them, and a capture taken mid-pulse pins a transition
// state instead of the rest the capture claims. The frame settle comes
// first, so an animation that starts with a late presented frame (a marker
// that mounts on its first placement) is running by the time the
// animations are read. They run once per load, so the wait falls through in
// one poll afterwards.
async function settledForCapture(page: Page): Promise<void> {
  await settledStage(page)
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.getAnimations().filter((animation) => animation.playState === 'running')
              .length,
        ),
      { timeout: testBodyBudgetMs },
    )
    .toBe(0)
}

// Captures the stage at rest: the settled wait first, then the shot. Two
// captures through this entry cover the same box, so they can be compared
// pixel for pixel.
export async function settledStageCapture(
  page: Page,
  extensions: readonly StageCaptureExtension[] = [],
): Promise<Uint8Array> {
  await settledForCapture(page)
  return maskedViewportCapture(page, extensions)
}

// Captures the presented state at the instant of the call: the standard
// mask, no rest wait. Its contract: the shot is counted on its own, against
// a threshold, and never compared with another capture. Only the rest waits
// pin the HUD's mask box, so a comparison across this entry can always race
// the drain.
export async function presentedStageCapture(
  page: Page,
  extensions: readonly StageCaptureExtension[] = [],
): Promise<Uint8Array> {
  return maskedViewportCapture(page, extensions)
}

// The visual snapshot of the settled contract: the settled wait and the
// standard mask, with the runner's own mask color, so a committed baseline
// keeps its pixels when only the capture's timing changes.
export async function expectSettledStageScreenshot(
  page: Page,
  snapshotName: string,
): Promise<void> {
  await settledForCapture(page)
  await expect(page).toHaveScreenshot(snapshotName, { mask: [...devHudMask(page)] })
}
