import { useEffect, useRef } from 'react'
import { createEscapeStack } from '@lib/dismiss'

// The escape owner of the page: one stack of the open dismissable layers
// (a hotspot card, the collection index) and one document keydown listener
// that hands Escape to the topmost layer only, whatever element holds
// focus: a layer's descendant, the layer's own element, or the body. The
// listener follows the router's own pattern: installed with the first
// open layer and removed with the last, so a document with no open layer
// listens for nothing.

const escapeStack = createEscapeStack()

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    escapeStack.dismissTopmost()
  }
}

let openLayers = 0

// Registers a dismissable surface as a layer while it is open. The layer
// reaches the latest dismiss through a ref, so a re-render of the owner
// never moves the layer on the stack: the register effect runs on the
// open flip alone, and the open-time order of the stack is the order the
// surfaces opened in.
export function useEscapeLayer(active: boolean, dismiss: () => void): void {
  const dismissRef = useRef(dismiss)
  useEffect(() => {
    dismissRef.current = dismiss
  })
  useEffect(() => {
    if (!active) {
      return
    }
    const unregister = escapeStack.register({ dismiss: () => dismissRef.current() })
    if (openLayers === 0) {
      document.addEventListener('keydown', onKeyDown)
    }
    openLayers += 1
    return () => {
      openLayers -= 1
      if (openLayers === 0) {
        document.removeEventListener('keydown', onKeyDown)
      }
      unregister()
    }
  }, [active])
}
