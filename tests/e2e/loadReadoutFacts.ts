// The readout's own page-side observers and probes, shared by the loading
// readout spec: the text recorder that misses nothing between mutations,
// the reveal recorder that catches the one animation the announcement
// rides, the token's documented delay override, and the figure the readout
// holds right now.

import type { Page } from '@playwright/test'

declare global {
  interface Window {
    // The readout texts the recorder saw, in order, one entry per change:
    // the short states between the last byte and readiness are exactly what
    // a poll can miss.
    __readoutTexts?: string[]
    __readoutLastText?: string
    // The animation names the readout's own reveal started.
    __readoutReveals?: string[]
  }
}

export async function recordReadoutTexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__readoutTexts = []
    window.__readoutLastText = ''
    const read = () => {
      const text = document.querySelector('[data-load-readout]')?.textContent ?? ''
      if (text !== window.__readoutLastText) {
        window.__readoutLastText = text
        window.__readoutTexts?.push(text)
      }
    }
    new MutationObserver(read).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  })
}

// Records the readout's own reveal animation starting: the one moment the
// CSS delay has passed, the signal the announcement rides. Animations the
// readout's children start (the marching segment) are not the reveal.
export async function recordReadoutReveals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__readoutReveals = []
    document.addEventListener(
      'animationstart',
      (event) => {
        if (event.target instanceof Element && event.target.matches('[data-load-readout]')) {
          window.__readoutReveals?.push(event.animationName)
        }
      },
      true,
    )
  })
}

// The id of the style node a held delay lives in.
const heldStyleId = 'hold-load-reveal-delay'

// Holds the reveal delay past any test's reach, before any of the page's
// own scripts run: the token's documented override, written into the
// document itself with the priority that beats the dev server's own sheet.
// The delay's real value stays the stylesheet gate's to hold.
export async function holdRevealDelay(page: Page, delayMs: number): Promise<void> {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html.replace(
        '</head>',
        `<style id="${heldStyleId}">:root { --delay-load-readout: ${delayMs}ms !important }</style></head>`,
      ),
    })
  })
}

// Releases a held reveal delay: the held style node leaves, the readout's
// animation recomputes against the token's own delay, and the reveal fires
// once that delay has run from the release. The release is deterministic
// because whatever waits for the reveal waits on the animation's own
// recorded start, never on a clock the test guesses.
export async function releaseRevealDelay(page: Page): Promise<void> {
  await page.evaluate((id) => {
    document.getElementById(id)?.remove()
  }, heldStyleId)
}

// The readout's figure right now, or null while it shows none.
export async function figureOf(page: Page): Promise<number | null> {
  const text = await page.locator('[data-load-readout]').textContent()
  const figure = / (\d+)%$/.exec(text ?? '')
  return figure === null ? null : Number(figure[1])
}

export async function recordedReadoutTexts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => window.__readoutTexts ?? [])
}

// Forgets the texts recorded so far: the assertions that follow watch what
// the page shows from this moment on.
export async function forgetRecordedReadoutTexts(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__readoutTexts !== undefined) {
      window.__readoutTexts.length = 0
    }
  })
}

export async function recordedReadoutReveals(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => window.__readoutReveals ?? [])
}

// The stage chrome corners the readout's box intersects right now: empty
// while it keeps clear. Touching edges are not overlap.
export async function chromeOverlaps(page: Page): Promise<readonly (string | null)[]> {
  return page.evaluate(() => {
    const readout = document.querySelector('[data-load-readout]')
    if (readout === null) {
      throw new Error('the readout left the page while the load was held')
    }
    const box = readout.getBoundingClientRect()
    return [...document.querySelectorAll('[data-corner]')]
      .filter((corner) => {
        const cornerBox = corner.getBoundingClientRect()
        const separated =
          box.right <= cornerBox.left ||
          cornerBox.right <= box.left ||
          box.bottom <= cornerBox.top ||
          cornerBox.bottom <= box.top
        return !separated
      })
      .map((corner) => corner.getAttribute('data-corner'))
  })
}
