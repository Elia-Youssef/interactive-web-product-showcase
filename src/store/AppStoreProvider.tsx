import { useState, type ReactNode } from 'react'
import { AppStoreContext } from './appStoreContext'
import { createAppStore } from './createAppStore'

type AppStoreProviderProps = {
  children: ReactNode
}

// One store per mount: the factory runs lazily on the first render and the
// instance lives as long as this provider does.
export function AppStoreProvider({ children }: AppStoreProviderProps) {
  const [store] = useState(createAppStore)

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>
}
