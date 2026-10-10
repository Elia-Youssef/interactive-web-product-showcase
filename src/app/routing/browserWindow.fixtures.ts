import { vi } from 'vitest'

// A window's history updates its own location and does not emit popstate.
export function browserWindow(href: string) {
  const events = new EventTarget()
  const location = new URL(href)
  const write = (_state: unknown, _title: string, target?: string | URL | null) => {
    if (target !== undefined && target !== null) {
      location.href = new URL(target, location).href
    }
  }
  return {
    location,
    history: {
      state: { entry: 'kept' },
      pushState: vi.fn(write),
      replaceState: vi.fn(write),
    },
    addEventListener: vi.fn((type: 'popstate', listener: () => void) =>
      events.addEventListener(type, listener),
    ),
    removeEventListener: vi.fn((type: 'popstate', listener: () => void) =>
      events.removeEventListener(type, listener),
    ),
    popstate: () => events.dispatchEvent(new Event('popstate')),
  }
}
