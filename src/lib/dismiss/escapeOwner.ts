// The escape owner of one document: the stack of its open dismissable
// layers and the one keydown listener that hands Escape to the topmost of
// them, whatever element holds focus. The listener is installed the moment
// the stack grows from empty and removed the moment it empties again,
// derived from the stack's own size, so no second truth sits beside the
// stack's contents. The target is a thunk, read at the first register and
// never at construction: a server render builds the owner and touches no
// document.

import { createEscapeStack, type EscapeLayer } from './escapeStack'

// The keydown the listener reads, structural: the browser's own
// KeyboardEvent carries it, and a plain Event with a key drives the test.
export type EscapeKeyEvent = Event & { readonly key?: string }

// What the listener attaches to: any target that takes a keydown listener,
// the browser's document among them.
export type KeyTarget = {
  addEventListener(type: 'keydown', listener: (event: EscapeKeyEvent) => void): void
  removeEventListener(type: 'keydown', listener: (event: EscapeKeyEvent) => void): void
}

export type EscapeOwner = {
  // Registers a dismissable surface as a layer while it is open and answers
  // its unregister, which keeps the listener in step with the stack.
  register(layer: EscapeLayer): () => void
}

export function createEscapeOwner(target: () => KeyTarget): EscapeOwner {
  const stack = createEscapeStack()
  let bound: KeyTarget | null = null
  let listening: ((event: EscapeKeyEvent) => void) | null = null

  const syncListener = () => {
    if (stack.size() > 0 && listening === null) {
      // The target is read once, with the listener it takes: a later read
      // could hand back a different object, and the listener would leave
      // on one it never arrived on.
      bound = target()
      const onKeydown = (event: EscapeKeyEvent) => {
        if (event.key === 'Escape') {
          stack.dismissTopmost()
        }
      }
      listening = onKeydown
      bound.addEventListener('keydown', onKeydown)
    } else if (stack.size() === 0 && listening !== null && bound !== null) {
      bound.removeEventListener('keydown', listening)
      bound = null
      listening = null
    }
  }

  return {
    register(layer) {
      const unregister = stack.register(layer)
      syncListener()
      return () => {
        unregister()
        syncListener()
      }
    },
  }
}
