import { useSyncExternalStore } from 'react'
import { useRouter } from './routerContext'

// The current path of the address bar, as React state. Back and forward
// re-render every reader through the one subscription, with no other
// wiring anywhere in the app.
export function useRoutePath(): string {
  const router = useRouter()
  return useSyncExternalStore(router.subscribeToPath, router.currentPathname)
}
