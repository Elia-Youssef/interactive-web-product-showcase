// The one read of the visitor's reduced motion preference, taken when a
// camera move is asked for: under prefers-reduced-motion the camera moves
// are instant, never eased.

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
