import type { Page, Route } from '@playwright/test'

// The network event and its release are driven by the test, with no clock.
export async function holdAsset(page: Page, path: string) {
  let held: Route | null = null
  let release: () => void = () => undefined
  let action: 'continue' | 'abort' = 'continue'
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**${path}`, async (route) => {
    held = route
    await released
    if (action === 'abort') await route.abort()
    else await route.continue()
  })
  return {
    isHeld: () => held !== null,
    release: (next: 'continue' | 'abort' = 'continue') => {
      action = next
      release()
    },
  }
}
