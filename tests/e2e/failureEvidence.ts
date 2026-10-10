import type { Page, TestInfo } from '@playwright/test'

export function recordFailureEvidence(page: Page, baseURL: string) {
  const requests: unknown[] = []
  page.on('requestfailed', (request) =>
    requests.push({
      kind: 'failed',
      url: request.url(),
      method: request.method(),
      resource: request.resourceType(),
      failure: request.failure(),
      at: Date.now(),
    }),
  )
  page.on('response', (response) => {
    if (response.status() >= 400)
      requests.push({
        kind: 'response',
        url: response.url(),
        status: response.status(),
        resource: response.request().resourceType(),
        at: Date.now(),
      })
  })
  return async (testInfo: TestInfo): Promise<void> => {
    if (testInfo.status === testInfo.expectedStatus) return
    const presentation = await page
      .evaluate(() => ({
        url: location.href,
        action: document.documentElement.dataset.presentationAction,
        completion: window.__viewer?.completion,
        overlay: window.__viewer?.overlay,
        cards: window.__harnessCardVisibilitySamples?.(),
      }))
      .catch((error: Error) => ({ failedRead: error.message }))
    const health = await page.request.get(baseURL).then(
      (response) => ({ status: response.status(), url: response.url() }),
      (error: Error) => ({ failedRequest: error.message }),
    )
    await testInfo.attach('request-and-presentation-evidence', {
      contentType: 'application/json',
      body: JSON.stringify({ requests, presentation, health }, null, 2),
    })
  }
}
