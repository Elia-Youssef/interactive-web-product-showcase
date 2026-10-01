import { createContext, useContext, useEffect } from 'react'
import type { ResourceHolds } from '@lib/async/resourceHolds'

// The context that hands the stage's resource holds to its content, next to
// the stage settle. One instance per stage mount, shared by every component
// that renders a loaded resource on that stage, so a resource handed from one
// component to the next in one commit stays held.
export const StageHoldsContext = createContext<ResourceHolds<object> | null>(null)

// Holds a loaded resource for as long as the calling component's effects are
// live, and releases it once they are gone for good: an unmount, or the
// component moving on to a different resource. The simulated remount of
// StrictMode keeps the hold, so a live resource is never released under the
// component that renders it.
export function useStageHold(resource: object, release: () => void): void {
  const holds = useContext(StageHoldsContext)

  useEffect(() => {
    if (holds === null) {
      throw new Error('a component that holds a loaded resource renders outside the stage')
    }
    holds.hold(resource)
    return () => {
      holds.drop(resource, release)
    }
  }, [holds, resource, release])
}
