import { expect, test } from './fixtures'
import { waitForProductReady } from './productSpecs'

// The e2e server serves the dev client entry with a client of its own that
// has no HMR WebSocket: an e2e run never hot-updates anything, and the live
// client's refused or dropped connection attempts land in the browser
// console, where the console gate fails the owning test. This spec reads the
// page's own requests while the product loads and settles: the entry module
// must be served, and no WebSocket may open. A dev server started by hand,
// without the e2e mark, keeps Vite's live client and opens that socket.
test('an e2e page opens no HMR WebSocket', async ({ page, backendPath }) => {
  const sockets: string[] = []
  let clientEntryStatus: number | undefined
  page.on('websocket', (socket) => {
    sockets.push(socket.url())
  })
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/@vite/client') {
      clientEntryStatus = response.status()
    }
  })

  await page.goto(backendPath)
  await waitForProductReady(page)

  expect(
    clientEntryStatus,
    'the dev client entry must be served, so the page runs the client this server chooses',
  ).toBe(200)
  expect(sockets, 'no WebSocket may open on an e2e page').toEqual([])
})
