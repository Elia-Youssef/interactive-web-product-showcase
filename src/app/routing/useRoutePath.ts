import { useSyncExternalStore } from 'react'
import { currentPathname, subscribeToPath } from './browserRouter'

// The current path of the address bar, as React state. Back and forward
// re-render every reader through the one subscription, with no other
// wiring anywhere in the app.
export function useRoutePath(): string {
  return useSyncExternalStore(subscribeToPath, currentPathname)
}
