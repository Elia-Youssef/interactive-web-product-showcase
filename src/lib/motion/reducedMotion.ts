// The visitor's reduced motion preference, owned once for the whole app:
// the media query is spelled here and nowhere else, and every reader takes
// the one-shot read, the live subscription, or both.

export const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

// One read of the preference, at the moment of the call: a motion asked
// for now is instant under the preference, whatever a later change brings.
export function prefersReducedMotion(): boolean {
  return window.matchMedia(reducedMotionQuery).matches
}

// Follows the preference live: the listener runs on every change until the
// release runs, so a reader that renders from the preference re-renders
// when the visitor turns it.
export function subscribeReducedMotion(listener: () => void): () => void {
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
