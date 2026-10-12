import type { Page } from '@playwright/test'

// A color token as the browser resolves it. A hidden probe paints the token
// and the engine answers with its own computed serialization, the same form
// every computed color an assertion reads takes, so a token compares by
// value whatever syntax spells it: hex, rgb(), or color channels inside
// another token. An undefined token throws instead of resolving to the
// transparent initial color. The probe sits out of flow, so reading a token
// moves no layout.
export async function resolvedTokenColor(page: Page, token: `--${string}`): Promise<string> {
  return page.evaluate((name) => {
    if (getComputedStyle(document.documentElement).getPropertyValue(name).trim() === '') {
      throw new Error(`the color token ${name} is not defined`)
    }
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
    probe.style.backgroundColor = `var(${name})`
    document.body.append(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  }, token)
}
