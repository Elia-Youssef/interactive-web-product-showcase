import { useContext } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import { AppStoreContext } from './appStoreContext'
import type { AppState } from './createAppStore'

export function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext)

  if (store === null) {
    throw new Error(
      'useAppStore was called outside of AppStoreProvider. Wrap the tree in AppStoreProvider.',
    )
  }

  return useStore(store, selector)
}

// The store instance itself, for bridges that must read the state at access
// time instead of subscribing to it. It is the same instance the surrounding
// provider created; the store stays the single source of truth.
export function useAppStoreApi(): StoreApi<AppState> {
  const store = useContext(AppStoreContext)

  if (store === null) {
    throw new Error(
      'useAppStoreApi was called outside of AppStoreProvider. Wrap the tree in AppStoreProvider.',
    )
  }

  return store
}
