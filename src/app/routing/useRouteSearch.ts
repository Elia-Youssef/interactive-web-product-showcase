import { useSyncExternalStore } from 'react'
import { useRouter } from './routerContext'

// The address bar exists only in the browser, so a server render carries
// the empty query: the link shows its path alone until the client render
// reads the real search.
function currentSearchOnServer(): string {
  return ''
}

// The current query string of the address bar, as React state, through the
// same subscription the path reads: the query is half of the in-app
// address, so a reader that renders part of the address re-renders when
// either half moves.
export function useRouteSearch(): string {
  const router = useRouter()
  return useSyncExternalStore(router.subscribeToPath, router.currentSearch, currentSearchOnServer)
}
