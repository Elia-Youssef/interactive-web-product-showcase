import { expect, test } from './fixtures'
import {
  harnessPath,
  harnessProducts,
  waitForProductReady,
  waitForSettledMemory,
} from './productSpecs'

// The hosts a local page's requests may go to: the dev server's own host
// names, loopback in its spellings. Anything else is a request that left
// the machine.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

const products = await harnessProducts()

for (const product of products) {
  test(`loading the ${product.slug} keeps every request on localhost`, async ({
    page,
    backendPath,
  }) => {
    const foreign: string[] = []
    page.on('request', (request) => {
      let url: URL
      try {
        url = new URL(request.url())
      } catch {
        return
      }
      const external =
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        !LOCAL_HOSTNAMES.has(url.hostname)
      if (external) {
        foreign.push(request.url())
      }
    })

    await page.goto(harnessPath(backendPath, product.slug))
    // Ready is the whole load for this promise: the model, the transcoder
    // workers and the texture fetches all ride the load that ready reports.
    await waitForProductReady(page)
    await waitForSettledMemory(page)

    expect(foreign, 'every request during a product load stayed on localhost').toEqual([])
  })
}
