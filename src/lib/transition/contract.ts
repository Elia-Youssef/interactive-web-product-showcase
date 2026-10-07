// The product switch transition: the one contract between the lifecycle that
// swaps products and the transition that hides the swap. The lifecycle drives
// the phase; the transition only draws it and reports when each motion has
// landed. The order is fixed: cover, then the swap, then reveal. The
// lifecycle swaps the product only once the stage is covered, and starts the
// reveal only once the next product reports ready, so no frame ever shows a
// half-swapped stage.
//
// - idle: nothing is drawn over the stage.
// - covering: the transition moves in; it calls onCovered once when the
//   stage is fully covered.
// - covered: the stage stays covered while the lifecycle disposes the old
//   product and loads the next one.
// - revealing: the transition moves out; it calls onRevealed once when the
//   stage is fully visible again.
//
// A transition honors reducedMotion with its own reduced form (a crossfade,
// or an instant cut), and still calls onCovered and onRevealed in order.
export type ProductTransitionPhase = 'idle' | 'covering' | 'covered' | 'revealing'

export interface ProductTransitionProps {
  readonly phase: ProductTransitionPhase
  readonly reducedMotion: boolean
  readonly onCovered: () => void
  readonly onRevealed: () => void
}
