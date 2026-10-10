import { createContext, useContext } from 'react'
import type { LoadLedger } from '@lib/async/loadLedger'

// The stage's load ledger, in context: the one bookkeeping of the bytes the
// stage's own downloads read, created by the stage per mount like its holds
// and its probes, so no module state and no second stage shares one. The
// environment loads above the canvas lives and the model loads inside it
// draw their reporters from it, and the bridge beside it mirrors its figure
// into the store.
const LoadLedgerContext = createContext<LoadLedger | null>(null)

export function useLoadLedger(): LoadLedger {
  const ledger = useContext(LoadLedgerContext)
  if (ledger === null) {
    throw new Error('the load ledger needs the stage: render it inside the stage')
  }
  return ledger
}

export function LoadLedgerProvider({
  ledger,
  children,
}: {
  readonly ledger: LoadLedger
  readonly children: React.ReactNode
}) {
  return <LoadLedgerContext.Provider value={ledger}>{children}</LoadLedgerContext.Provider>
}
