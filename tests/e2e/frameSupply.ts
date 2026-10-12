import type { Page } from '@playwright/test'

type FrameSupply = {
  readonly hold: () => void
  readonly release: () => void
}

declare global {
  interface Window {
    __frameSupply?: FrameSupply
  }
}

// Holds the browser's requested frame callbacks while network, React and
// CSS motion continue normally. Releasing resumes those same requests on
// the native frame supply, without inventing a frame or changing a clock.
// Install before navigation, so the engine captures the controlled entry.
export async function controlFrameSupply(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window)
    const cancel = window.cancelAnimationFrame.bind(window)
    const requests = new Map<number, { callback: FrameRequestCallback; native: number | null }>()
    let held = false
    let next = 0
    const schedule = (id: number): void => {
      const entry = requests.get(id)
      if (entry === undefined) {
        return
      }
      entry.native = request((time) => {
        entry.native = null
        if (!held && requests.delete(id)) {
          entry.callback(time)
        }
      })
    }
    window.requestAnimationFrame = (callback) => {
      const id = ++next
      requests.set(id, { callback, native: null })
      if (!held) {
        schedule(id)
      }
      return id
    }
    window.cancelAnimationFrame = (id) => {
      const entry = requests.get(id)
      if (entry?.native !== undefined && entry.native !== null) {
        cancel(entry.native)
      }
      requests.delete(id)
    }
    window.__frameSupply = {
      hold: () => {
        held = true
      },
      release: () => {
        held = false
        for (const [id, entry] of requests) {
          if (entry.native === null) {
            schedule(id)
          }
        }
      },
    }
  })
}

export async function holdFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__frameSupply === undefined) {
      throw new Error('the frame supply control is not installed')
    }
    window.__frameSupply.hold()
  })
}

export async function releaseFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__frameSupply === undefined) {
      throw new Error('the frame supply control is not installed')
    }
    window.__frameSupply.release()
  })
}
