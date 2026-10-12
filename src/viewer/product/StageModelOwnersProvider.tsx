import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useStageProbes } from '../automation/stageProbesContext'
import { StageModelOwners } from './StageModelOwners'

const ModelOwnersContext = createContext<StageModelOwners | null>(null)

export function useStageModelOwners(): StageModelOwners {
  const owners = useContext(ModelOwnersContext)
  if (owners === null) {
    throw new Error('model loads need the stage model owner provider')
  }
  return owners
}

export function StageModelOwnersProvider({ children }: { readonly children: ReactNode }) {
  const [owners] = useState(() => new StageModelOwners())
  const probes = useStageProbes()
  useEffect(() => probes.register('loads', () => owners.report()), [probes, owners])
  return <ModelOwnersContext.Provider value={owners}>{children}</ModelOwnersContext.Provider>
}
