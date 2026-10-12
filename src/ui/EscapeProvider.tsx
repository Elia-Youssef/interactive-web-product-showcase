import { createContext, useContext, useState, type ReactNode } from 'react'
import { createEscapeOwner, type EscapeOwner } from '@lib/dismiss'

// The escape owner of the document, in context. One provider owns one
// owner per mount: the layers that open inside it share one stack and one
// keydown listener, and two providers (two documents, two windows) each
// answer their own keys. The owner's target is a thunk, so the provider
// renders on the server and touches no document until a layer registers.
const EscapeOwnerContext = createContext<EscapeOwner | null>(null)

// Provides the escape owner to the layers of one document: the page that
// hosts dismissable surfaces mounts it around them.
export function EscapeProvider({ children }: { readonly children: ReactNode }) {
  const [owner] = useState(() => createEscapeOwner(() => document))
  return <EscapeOwnerContext.Provider value={owner}>{children}</EscapeOwnerContext.Provider>
}

export function useEscapeOwner(): EscapeOwner {
  const owner = useContext(EscapeOwnerContext)
  if (owner === null) {
    throw new Error('an escape layer needs the escape provider: render it inside one')
  }
  return owner
}
