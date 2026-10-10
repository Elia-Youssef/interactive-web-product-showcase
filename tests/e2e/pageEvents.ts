import type { ConsoleMessage, Page } from '@playwright/test'

// Resolves once the page has logged `count` console errors after the call.
// Several concurrent page.waitForEvent calls all resolve on the same first
// matching event, so waiting for more than one error needs one listener that
// counts. Register it before the cause, as every waiter must be: by the time
// this resolves the gate has received every error and holds its argument
// reads. The gate drains those asynchronous reads before checking its verdict.
export function consoleErrors(page: Page, count: number): Promise<void> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`consoleErrors waits for a positive whole count, got ${count}`)
  }
  return new Promise((resolve) => {
    let seen = 0
    const onConsole = (message: ConsoleMessage): void => {
      if (message.type() !== 'error') {
        return
      }
      seen += 1
      if (seen === count) {
        page.off('console', onConsole)
        resolve()
      }
    }
    page.on('console', onConsole)
  })
}
