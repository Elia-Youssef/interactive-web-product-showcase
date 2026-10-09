import { useSyncExternalStore } from 'react'
import { prefersReducedMotion, subscribeReducedMotion } from '@lib/motion/reducedMotion'

// The visitor's reduced motion preference as React state, followed live: a
// change of the system setting re-renders the reader.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readPreference)
}

function subscribe(listener: () => void): () => void {
  return subscribeReducedMotion(listener)
}

function readPreference(): boolean {
  return prefersReducedMotion()
}
