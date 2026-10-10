import { formatAppHref } from '@lib/routing'

export type NavigationOptions = {
  // Replace the current history entry instead of pushing one. The root
  // path uses this, so back from the first product leaves the site instead
  // of landing on a page that would bounce forward again.
  readonly replace?: boolean
}

export type RouterWindow = {
  readonly location: Pick<Location, 'pathname' | 'search'>
  readonly history: Pick<History, 'state' | 'pushState' | 'replaceState'>
  readonly addEventListener: (type: 'popstate', listener: () => void) => void
  readonly removeEventListener: (type: 'popstate', listener: () => void) => void
}

// One history writer and subscription source for the window its root owns.
// Construction has no effects; subscriptions alone attach the browser listener.
export class BrowserRouter {
  private readonly listeners = new Set<() => void>()
  private disposed = false

  constructor(private readonly browser: RouterWindow) {}

  // Read the address at access time rather than retaining a second copy.
  readonly currentPathname = (): string => this.browser.location.pathname
  readonly currentSearch = (): string => this.browser.location.search

  readonly subscribeToPath = (listener: () => void): (() => void) => {
    this.assertLive()
    // Each subscription owns its registration, even for the same callback.
    const registration = () => listener()
    if (this.listeners.size === 0) {
      this.browser.addEventListener('popstate', this.notifyListeners)
    }
    this.listeners.add(registration)
    return () => {
      if (this.listeners.delete(registration) && this.listeners.size === 0) {
        this.browser.removeEventListener('popstate', this.notifyListeners)
      }
    }
  }

  // Links and history entries use the same formatter, including the query.
  readonly navigate = (path: string, options: NavigationOptions = {}): void => {
    this.assertLive()
    const target = formatAppHref(path, this.currentSearch())
    if (options.replace === true) {
      this.browser.history.replaceState(this.browser.history.state, '', target)
    } else {
      this.browser.history.pushState(this.browser.history.state, '', target)
    }
    this.notifyListeners()
  }

  readonly dispose = (): void => {
    if (this.disposed) {
      return
    }
    this.disposed = true
    if (this.listeners.size > 0) {
      this.browser.removeEventListener('popstate', this.notifyListeners)
    }
    this.listeners.clear()
  }

  private readonly notifyListeners = (): void => {
    for (const listener of this.listeners) {
      listener()
    }
  }

  private assertLive(): void {
    if (this.disposed) {
      throw new Error('a disposed router cannot navigate or subscribe')
    }
  }
}
