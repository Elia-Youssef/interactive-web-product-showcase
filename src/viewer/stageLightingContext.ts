import { createContext, useContext } from 'react'

// A canvas may download and open content before its lighting arrives, but
// it may present a loaded scene only after the environment is installed.
export const StageLightingContext = createContext(false)

export function useStageLighting(): boolean {
  return useContext(StageLightingContext)
}
