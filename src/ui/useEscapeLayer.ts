import { useEffect, useRef } from 'react'
import { useEscapeOwner } from './EscapeProvider'

// Registers a dismissable surface as a layer of the document's escape
// owner while it is open: Escape reaches the topmost open layer only,
// whatever element holds focus. The layer reaches the latest dismiss
// through a ref, so a re-render of the owner never moves the layer on the
// stack: the register effect runs on the open flip alone, and the open-time
// order of the stack is the order the surfaces opened in.
export function useEscapeLayer(active: boolean, dismiss: () => void): void {
  const owner = useEscapeOwner()
  const dismissRef = useRef(dismiss)
  useEffect(() => {
    dismissRef.current = dismiss
  })
  useEffect(() => {
    if (!active) {
      return
    }
    return owner.register({ dismiss: () => dismissRef.current() })
  }, [active, owner])
}
