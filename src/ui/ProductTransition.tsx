// The product switch transition: the diagonal ticker band that covers the
// stage while the lifecycle swaps products. It draws exactly the contract:
// idle draws nothing, covering sweeps the band in and calls onCovered from
// the motion's real end, covered holds, revealing sweeps it out and calls
// onRevealed the same way. Reduced motion swaps the band for a plain
// crossfade of the same red, through the same phases and callbacks. The
// whole surface is decorative: it hides from assistive tech, holds
// nothing focusable and never takes a pointer event, so the stage under it
// keeps every drag. The ticker text is the collection's own words from the
// site copy, never written here.

import { Fragment } from 'react'
import { siteCopy } from '@lib/copy/site'
import type { ProductTransitionPhase, ProductTransitionProps } from '@lib/transition'
import styles from './ProductTransition.module.css'
import { joinClassNames } from './joinClassNames'
import { useMotionCallbacks } from './useMotionCallbacks'

type ActivePhase = Exclude<ProductTransitionPhase, 'idle'>

// The words the ticker repeats, in the band's reading order.
const TICKER_WORDS = [siteCopy.studioName, siteCopy.collectionName] as const

/*
The repetitions of the word run per marquee half. Two identical halves
render, and the marquee shifts by exactly one half, so one half must
outmeasure the band: at the token text size one word run is about 640px,
so twelve runs pass 7500px and stay wider than the band's 250% of the
widest stage the layout builds.
*/
const TICKER_RUNS_PER_HALF = 12

export function ProductTransition({
  phase,
  reducedMotion,
  onCovered,
  onRevealed,
}: ProductTransitionProps) {
  const moverRef = useMotionCallbacks({ phase, reducedMotion, onCovered, onRevealed })

  if (phase === 'idle') {
    return null
  }

  return (
    <div className={styles.root} aria-hidden="true">
      {reducedMotion ? (
        <div ref={moverRef} className={joinClassNames(styles.fade, phaseClass(phase))} />
      ) : (
        <div ref={moverRef} className={joinClassNames(styles.band, phaseClass(phase))}>
          <TickerTrack />
        </div>
      )}
    </div>
  )
}

function phaseClass(phase: ActivePhase): string | undefined {
  switch (phase) {
    case 'covering':
      return styles.covering
    case 'covered':
      return styles.covered
    case 'revealing':
      return styles.revealing
  }
}

function TickerTrack() {
  return (
    <div className={styles.track}>
      <TickerHalf />
      <TickerHalf />
    </div>
  )
}

function TickerHalf() {
  const runs = Array.from({ length: TICKER_RUNS_PER_HALF }, (_word, run) => (
    <Fragment key={run}>
      {TICKER_WORDS.map((word) => (
        <Fragment key={word}>
          <span className={styles.word}>{word}</span>
          <span className={styles.dot} />
        </Fragment>
      ))}
    </Fragment>
  ))
  return <div className={styles.half}>{runs}</div>
}
