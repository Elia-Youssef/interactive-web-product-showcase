import { ResourceHolds } from '@lib/async/resourceHolds'
import type { AfterFlush } from '@lib/async/resourceHolds'
import type { BrowserRouter } from './browserRouter'

// Effect replay reacquires the service in the same flush; a final unmount
// releases it after the flush, once every child subscription has left.
export function createRouterLifetime(
  afterFlush: AfterFlush = (callback) => queueMicrotask(callback),
) {
  const holds = new ResourceHolds<BrowserRouter>(afterFlush)
  return (router: BrowserRouter): (() => void) => {
    holds.hold(router)
    return () => holds.drop(router, router.dispose)
  }
}
