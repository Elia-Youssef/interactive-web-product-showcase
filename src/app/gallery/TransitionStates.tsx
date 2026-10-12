// The product switch transition in the gallery: a stage-sized box for the
// band to cover, controls that step the phases by hand, the reduced-motion
// toggle that drives the contract's own prop, and a log of the callbacks
// the transition fires, in fire order. The rest of the gallery is a static
// look review; this section exists so the phases, both motion forms and
// the callback order can be driven and watched on one page.

import { useState } from 'react'
import type { ProductTransitionPhase } from '@lib/transition'
import backdrop from '@styles/StageBackdrop.module.css'
import { Eyebrow, ProductTransition, Readout, TextButton } from '@ui/index'
import styles from './gallery.module.css'

const PHASES = [
  { phase: 'idle', label: 'Idle' },
  { phase: 'covering', label: 'Covering' },
  { phase: 'covered', label: 'Covered' },
  { phase: 'revealing', label: 'Revealing' },
] as const satisfies readonly { phase: ProductTransitionPhase; label: string }[]

export function TransitionStates() {
  const [phase, setPhase] = useState<ProductTransitionPhase>('idle')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [fired, setFired] = useState<readonly string[]>([])

  return (
    <section className={styles.transition} aria-label="The product switch transition">
      <Eyebrow>ProductTransition</Eyebrow>
      <div className={styles.transitionStage} data-transition-stage>
        <div className={backdrop.backdrop} />
        <div className={styles.transitionSlot} data-transition-slot>
          <ProductTransition
            phase={phase}
            reducedMotion={reducedMotion}
            onCovered={() => setFired((log) => [...log, 'covered'])}
            onRevealed={() => setFired((log) => [...log, 'revealed'])}
          />
        </div>
      </div>
      <div className={styles.transitionControls}>
        {PHASES.map((step) => (
          <TextButton
            key={step.phase}
            selected={phase === step.phase}
            onClick={() => setPhase(step.phase)}
          >
            {step.label}
          </TextButton>
        ))}
        <label className={styles.transitionToggle}>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          Reduced motion
        </label>
      </div>
      <ol className={styles.transitionLog} aria-label="Fired transition callbacks">
        {fired.map((name, index) => (
          <li key={index}>
            <Readout>{name}</Readout>
          </li>
        ))}
      </ol>
    </section>
  )
}
