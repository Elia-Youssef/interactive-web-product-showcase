import { Suspense, useState, type ReactNode } from 'react'
import { StageEnvironment } from './StageEnvironment'
import { StageLightingContext } from './stageLightingContext'

// The environment alone suspends. Content commits its loading effects at
// once, while the lighting context gates its eventual scene presentation.
// Readiness is canvas-local because every renderer owns its own PMREM.
export function StageLighting({ children }: { readonly children: ReactNode }) {
  const [installed, setInstalled] = useState(false)
  return (
    <StageLightingContext.Provider value={installed}>
      <Suspense fallback={null}>
        <StageEnvironment onInstalled={setInstalled} />
      </Suspense>
      {children}
    </StageLightingContext.Provider>
  )
}
