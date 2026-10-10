import { expect, test, vi } from 'vitest'
import { BrowserRouter } from './browserRouter'
import { browserWindow } from './browserWindow.fixtures'
import { createRouterLifetime } from './routerLifetime'

test('effect replay keeps a live service and final unmount disposes all registrations', () => {
  const flush: (() => void)[] = []
  const hold = createRouterLifetime((callback) => flush.push(callback))
  const browser = browserWindow('https://app.invalid/')
  const router = new BrowserRouter(browser)
  const releaseFirst = hold(router)
  const listener = vi.fn()
  router.subscribeToPath(listener)
  releaseFirst()
  const releaseReplay = hold(router)
  for (const callback of flush.splice(0)) callback()
  router.navigate('/p/replayed')
  expect(listener).toHaveBeenCalledTimes(1)
  expect(browser.removeEventListener).not.toHaveBeenCalled()
  releaseReplay()
  for (const callback of flush.splice(0)) callback()
  browser.popstate()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(browser.removeEventListener).toHaveBeenCalledTimes(1)
  expect(() => router.subscribeToPath(listener)).toThrow('disposed router')
})

test('owner replacement disposes the previous service without touching the new owner', async () => {
  const hold = createRouterLifetime()
  const first = new BrowserRouter(browserWindow('https://first.invalid/'))
  const second = new BrowserRouter(browserWindow('https://second.invalid/'))
  const releaseFirst = hold(first)
  releaseFirst()
  const releaseSecond = hold(second)
  await Promise.resolve()
  expect(() => first.navigate('/p/late')).toThrow('disposed router')
  second.navigate('/p/live')
  expect(second.currentPathname()).toBe('/p/live')
  releaseSecond()
  await Promise.resolve()
  expect(() => second.navigate('/p/late')).toThrow('disposed router')
})
