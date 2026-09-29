import { createContext } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import type { AppState } from './createAppStore'

// The context holds the one store instance the provider created. Null until
// a provider mounts, so the hook can fail with a clear message instead of
// reading a module-level singleton.
export const AppStoreContext = createContext<StoreApi<AppState> | null>(null)
