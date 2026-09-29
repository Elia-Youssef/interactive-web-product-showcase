import { useContext } from 'react'
import { useStore } from 'zustand'
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
