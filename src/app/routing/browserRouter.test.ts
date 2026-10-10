import { expect, test, vi } from 'vitest'
import { BrowserRouter } from './browserRouter'
import { browserWindow } from './browserWindow.fixtures'

test('subscriptions of two window owners receive only their own history events', () => {
  const first = browserWindow('https://first.invalid/p/first?backend=webgl')
  const second = browserWindow('https://second.invalid/p/second?other=value')
  const onFirst = vi.fn()
  const onSecond = vi.fn()
  const firstRouter = new BrowserRouter(first)
  const secondRouter = new BrowserRouter(second)
  const releaseFirst = firstRouter.subscribeToPath(onFirst)
  const releaseSecond = secondRouter.subscribeToPath(onSecond)
  try {
    first.popstate()
    expect(onFirst).toHaveBeenCalledTimes(1)
    expect(onSecond).not.toHaveBeenCalled()
    second.popstate()
    expect(onSecond).toHaveBeenCalledTimes(1)
  } finally {
    releaseSecond()
    releaseFirst()
  }
})

test('each owner reads and writes only its own location, query and history state', () => {
  const first = browserWindow('https://first.invalid/p/first?backend=webgl')
  const second = browserWindow('https://second.invalid/p/second?other=value')
  const a = new BrowserRouter(first)
  const b = new BrowserRouter(second)
  const onFirst = vi.fn()
  const onSecond = vi.fn()
  a.subscribeToPath(onFirst)
  b.subscribeToPath(onSecond)
  a.navigate('/p/next')
  expect(first.history.pushState).toHaveBeenCalledExactlyOnceWith(
    first.history.state,
    '',
    '/p/next?backend=webgl',
  )
  expect(a.currentPathname()).toBe('/p/next')
  expect(a.currentSearch()).toBe('?backend=webgl')
  expect(b.currentPathname()).toBe('/p/second')
  expect(b.currentSearch()).toBe('?other=value')
  expect(onFirst).toHaveBeenCalledTimes(1)
  expect(onSecond).not.toHaveBeenCalled()
  b.navigate('/p/replaced', { replace: true })
  expect(second.history.replaceState).toHaveBeenCalledExactlyOnceWith(
    second.history.state,
    '',
    '/p/replaced?other=value',
  )
  expect(second.history.pushState).not.toHaveBeenCalled()
  first.location.search = '?changed=live'
  expect(a.currentSearch()).toBe('?changed=live')
  a.dispose()
  b.dispose()
})

test('construction is inert and first and last subscriptions own the browser listener', () => {
  const browser = browserWindow('https://app.invalid/')
  const router = new BrowserRouter(browser)
  expect(browser.addEventListener).not.toHaveBeenCalled()
  const releaseFirst = router.subscribeToPath(vi.fn())
  const releaseSecond = router.subscribeToPath(vi.fn())
  expect(browser.addEventListener).toHaveBeenCalledTimes(1)
  releaseFirst()
  releaseFirst()
  expect(browser.removeEventListener).not.toHaveBeenCalled()
  releaseSecond()
  expect(browser.removeEventListener).toHaveBeenCalledExactlyOnceWith(
    ...(browser.addEventListener.mock.calls[0] ?? []),
  )
  const releaseThird = router.subscribeToPath(vi.fn())
  expect(browser.addEventListener).toHaveBeenCalledTimes(2)
  releaseThird()
  expect(browser.removeEventListener).toHaveBeenCalledTimes(2)
})

test('repeated callback registrations have independent and idempotent releases', () => {
  const browser = browserWindow('https://app.invalid/')
  const router = new BrowserRouter(browser)
  const listener = vi.fn()
  const releaseFirst = router.subscribeToPath(listener)
  const releaseSecond = router.subscribeToPath(listener)
  releaseFirst()
  releaseFirst()
  browser.popstate()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(browser.removeEventListener).not.toHaveBeenCalled()
  releaseSecond()
  browser.popstate()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(browser.removeEventListener).toHaveBeenCalledTimes(1)
})

test('disposal clears retained registrations, detaches once and rejects later use', () => {
  const browser = browserWindow('https://app.invalid/')
  const router = new BrowserRouter(browser)
  const listener = vi.fn()
  const release = router.subscribeToPath(listener)
  router.subscribeToPath(listener)
  const registration = browser.addEventListener.mock.calls[0]?.[1]
  router.dispose()
  router.dispose()
  release()
  browser.popstate()
  registration?.()
  expect(listener).not.toHaveBeenCalled()
  expect(browser.removeEventListener).toHaveBeenCalledTimes(1)
  expect(() => router.subscribeToPath(listener)).toThrow('disposed router')
  expect(() => router.navigate('/p/late')).toThrow('disposed router')
  expect(browser.history.pushState).not.toHaveBeenCalled()
})
