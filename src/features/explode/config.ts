import { springSettings } from '@lib/explode'

// The exploded view's tunables, with their units. The spring settings are
// validated and their angular speed derived here once, so nothing downstream
// re-derives them per frame.

// A full move from one end to the other settles in under a second, at the
// site's motion scale for eased moves.
export const explodeSpring = springSettings(0.8, 0.001)

// The rest band is a thousandth of the full travel: far below the first
// visible pose difference of a clip, and snapping there ends the move on an
// exact comparison, which is what stops the demand-mode frame loop.
// (Stated here because it lives in the config that names it; the derivation
// of the speed from it is the spring module's.)

// Under this media query a toggle jumps straight to its target in one
// frame: reduced motion cuts eased moves, per the site's motion rules.
export const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
