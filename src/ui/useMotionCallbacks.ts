// The callback wiring of the product switch transition: it holds the
// ledger of the owed callback, pays from the end of the CSS motion, and
// hands back the ref of the mover the CSS animation runs on.
//
// The payment reads the motion's end through the Web Animations API: the
// finished promise is the animation's own state machine, so a full-pace
// move resolves exactly when it lands and the instant form of reduced
// motion (zero duration) resolves as soon as the style lands, with no
// event dispatch to lose. A motion replaced mid-run has its animation
// canceled, which rejects the promise of the run that tracked it: that
// rejection is the retarget path, and the run that replaced it pays its
// own end. The ledger decides what every end means, so a phase left
// mid-motion owes nothing and no callback fires twice.

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { initialTransitionCallbacks, stepTransitionCallbacks } from '@lib/transition'
import type { ProductTransitionProps, TransitionCallbacksStep } from '@lib/transition'

type MotionCallbacks = Pick<
  ProductTransitionProps,
  'phase' | 'reducedMotion' | 'onCovered' | 'onRevealed'
>

export function useMotionCallbacks({
  phase,
  reducedMotion,
  onCovered,
  onRevealed,
}: MotionCallbacks): RefObject<HTMLDivElement | null> {
  const ledger = useRef(initialTransitionCallbacks)
  const moverRef = useRef<HTMLDivElement | null>(null)
  const runToken = useRef(0)
  const onCoveredRef = useRef(onCovered)
  const onRevealedRef = useRef(onRevealed)

  useEffect(() => {
    onCoveredRef.current = onCovered
    onRevealedRef.current = onRevealed
  })

  // The debt of a phase lands before the browser can start the phase's
  // animation, whose end may be instant under reduced motion.
  useLayoutEffect(() => {
    ledger.current = stepTransitionCallbacks(ledger.current, { kind: 'phase', phase }).state
  }, [phase])

  // The payment: the finish of the motion the phase just started, tracked
  // on the mover the CSS animation runs on.
  useLayoutEffect(() => {
    const mover = moverRef.current
    if (phase === 'idle' || mover === null) {
      return
    }
    const run = runToken.current + 1
    runToken.current = run
    Promise.all(mover.getAnimations().map((animation) => animation.finished)).then(
      () => {
        if (runToken.current !== run) {
          return
        }
        const step = stepTransitionCallbacks(ledger.current, { kind: 'ended' })
        ledger.current = step.state
        fireCallback(step.fired, onCoveredRef.current, onRevealedRef.current)
      },
      () => {
        // The run was superseded or the surface unmounted: the animation
        // was canceled without finishing, so this run owes nothing. The
        // run that replaced it settles the ledger through its own finish,
        // which holds the debt unchanged until then.
      },
    )
    // Even an empty or already finished animation can resolve after the
    // effect ends. Cancellation alone cannot invalidate that continuation.
    return () => {
      runToken.current += 1
    }
  }, [phase, reducedMotion])

  return moverRef
}

function fireCallback(
  fired: TransitionCallbacksStep['fired'],
  onCovered: () => void,
  onRevealed: () => void,
): void {
  switch (fired) {
    case 'covered':
      onCovered()
      break
    case 'revealed':
      onRevealed()
      break
    case null:
      break
  }
}
