// The browser side of the routing: the one writer of history and the one
// subscription source React reads the location through. The location is
// never copied into module state: the snapshot is location read at access
// time, so no mirror of it can go stale.

import { formatAppHref } from '@lib/routing'

export type NavigationOptions = {
  // Replace the current history entry instead of pushing one. The root
  // path uses this, so back from the first product leaves the site instead
  // of landing on a page that would bounce forward again.
  readonly replace?: boolean
}

type PathListener = () => void

const listeners = new Set<PathListener>()

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

// The useSyncExternalStore snapshot: location.pathname itself. Strings
// compare by value, so a notification that did not move the path
// re-renders nothing.
export function currentPathname(): string {
  return window.location.pathname
}

// The query string of the address bar, read at access time like the
// pathname. The in-app address is the path and the query together, so a
// reader that renders part of the address reads both through the router.
export function currentSearch(): string {
  return window.location.search
}

// Subscribes to every way the path can change: the browser's back and
// forward (popstate), and this module's own navigations, which fire no
// event and are told to the listeners directly in navigate.
export function subscribeToPath(listener: PathListener): () => void {
  const isFirst = listeners.size === 0
  listeners.add(listener)
  if (isFirst) {
    window.addEventListener('popstate', notifyListeners)
  }
  return () => {
    const wasLast = listeners.size === 1
    listeners.delete(listener)
    if (wasLast) {
      window.removeEventListener('popstate', notifyListeners)
    }
  }
}

// The only history writer of the app. The query string always rides along
// through the one href formatter, so the entry pushed here is the same
// address a link on the page renders.
export function navigate(path: string, options: NavigationOptions = {}): void {
  const target = formatAppHref(path, currentSearch())
  if (options.replace === true) {
    window.history.replaceState(window.history.state, '', target)
  } else {
    window.history.pushState(window.history.state, '', target)
  }
  notifyListeners()
}
