import { act, StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  RouterProvider,
  RouteLink,
  useNavigate,
  useRoutePath,
  useRouteSearch,
} from '../routing'

function observedWindow(browser: Window) {
  const registrations = new Set<() => void>()
  let added = 0
  let removed = 0
  return {
    location: browser.location,
    history: browser.history,
    addEventListener(type: 'popstate', listener: () => void) {
      added++
      registrations.add(listener)
      browser.addEventListener(type, listener)
    },
    removeEventListener(type: 'popstate', listener: () => void) {
      removed++
      registrations.delete(listener)
      browser.removeEventListener(type, listener)
    },
    reading: () => ({ active: registrations.size, added, removed }),
  }
}

function Reader({ onEffect }: { readonly onEffect: () => void }) {
  const path = useRoutePath()
  const search = useRouteSearch()
  const navigate = useNavigate()
  useEffect(onEffect, [onEffect])
  return (
    <>
      <output>
        {path}
        {search}
      </output>
      <RouteLink to="/p/linked">Link</RouteLink>
      <button onClick={() => navigate('/p/requested')}>Navigate</button>
    </>
  )
}

function requireProof(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

async function childWindow(): Promise<{
  readonly frame: HTMLIFrameElement
  readonly browser: Window
}> {
  const frame = document.createElement('iframe')
  const loaded = new Promise<void>((resolve) =>
    frame.addEventListener('load', () => resolve(), { once: true }),
  )
  frame.src = location.pathname
  document.body.append(frame)
  await loaded
  const browser = frame.contentWindow
  if (browser === null) throw new Error('the frame has no window')
  return { frame, browser }
}

export async function proveRouterLifecycle(): Promise<string[]> {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const first = await childWindow()
  const second = await childWindow()
  try {
    return await proveOwners(first.browser, second.browser)
  } finally {
    first.frame.remove()
    second.frame.remove()
  }
}

async function mountedOwner(browser: Window, onEffect: () => void) {
  const observed = observedWindow(browser)
  const router = new BrowserRouter(observed)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(
      <StrictMode>
        <RouterProvider router={router}>
          <Reader onEffect={onEffect} />
        </RouterProvider>
      </StrictMode>,
    )
  })
  return { observed, router, host, root }
}

async function proveOwners(first: Window, second: Window): Promise<string[]> {
  first.history.replaceState({ owner: 'first' }, '', '/p/first?backend=webgl')
  second.history.replaceState({ owner: 'second' }, '', '/p/second?other=value')
  let effects = 0
  const onEffect = () => {
    effects++
  }
  const a = await mountedOwner(first, onEffect)
  const b = await mountedOwner(second, onEffect)
  try {
    requireProof(effects === 4, 'StrictMode did not replay both roots')
    requireProof(
      a.observed.reading().active === 1 &&
        a.observed.reading().added === 2 &&
        a.observed.reading().removed === 1,
      'first root did not replay its browser subscription',
    )
    requireProof(
      b.observed.reading().active === 1,
      'second root has no independent browser listener',
    )
    await proveNavigation(a.host, b.host, first, second)
    await proveUnmount(a.root, a.router, a.observed, first, b.host)
    return [
      'StrictMode replay',
      'independent context readers',
      'bound navigate and RouteLink',
      'query-only popstate',
      'unmount clears retained registrations',
      'surviving owner',
    ]
  } finally {
    await act(async () => {
      a.root.unmount()
      b.root.unmount()
    })
    requireProof(
      a.observed.reading().active === 0 && b.observed.reading().active === 0,
      'a root retained its browser listener',
    )
    a.host.remove()
    b.host.remove()
  }
}

async function proveNavigation(
  hostA: HTMLElement,
  hostB: HTMLElement,
  first: Window,
  second: Window,
) {
  requireProof(
    hostA.querySelector('a')?.getAttribute('href') === '/p/linked?backend=webgl',
    'first link read the wrong search',
  )
  requireProof(
    hostB.querySelector('a')?.getAttribute('href') === '/p/linked?other=value',
    'second link read the wrong search',
  )
  await act(async () => hostA.querySelector('button')?.click())
  requireProof(
    hostA.querySelector('output')?.textContent === '/p/requested?backend=webgl',
    'navigate did not update its own reader',
  )
  requireProof(
    hostB.querySelector('output')?.textContent === '/p/second?other=value',
    'navigate moved the other reader',
  )
  await act(async () => hostB.querySelector('a')?.click())
  requireProof(
    second.location.pathname === '/p/linked' && first.location.pathname === '/p/requested',
    'link wrote the wrong history',
  )
  await act(async () => {
    second.history.replaceState(second.history.state, '', '/p/linked?changed=live')
    second.dispatchEvent(new Event('popstate'))
  })
  requireProof(
    hostB.querySelector('a')?.getAttribute('href') === '/p/linked?changed=live',
    'query-only popstate did not update the link',
  )
}

async function proveUnmount(
  root: ReturnType<typeof createRoot>,
  router: BrowserRouter,
  browser: ReturnType<typeof observedWindow>,
  first: Window,
  survivingHost: HTMLElement,
) {
  let notifications = 0
  router.subscribeToPath(() => {
    notifications++
  })
  await act(async () => root.unmount())
  first.dispatchEvent(new Event('popstate'))
  requireProof(
    browser.reading().active === 0 && notifications === 0,
    'unmount retained an extra registration',
  )
  let disposed = false
  try {
    router.navigate('/p/late')
  } catch (error) {
    disposed = error instanceof Error && error.message.includes('disposed router')
  }
  requireProof(disposed, 'provider did not dispose its router')
  await act(async () => survivingHost.querySelector('button')?.click())
  requireProof(
    survivingHost.querySelector('output')?.textContent === '/p/requested?changed=live',
    'unmount disposed the surviving owner',
  )
}
