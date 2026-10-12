// The dev-only gallery page: every primitive in every state, rendered once
// on the stage backdrop and once on the flat panel background.

import { Eyebrow } from '@ui/index'
import backdrop from '@styles/StageBackdrop.module.css'
import { PrimitiveStates } from './PrimitiveStates'
import styles from './gallery.module.css'
import { TransitionStates } from './TransitionStates'

export function Gallery() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Eyebrow>Rebel Art Studios / UI primitives</Eyebrow>
      </header>
      <section className={styles.stage} aria-label="The primitives on the stage backdrop">
        <div className={backdrop.backdrop} />
        <div className={styles.stageContent}>
          <PrimitiveStates />
        </div>
      </section>
      <TransitionStates />
      <section className={styles.panel} aria-label="The primitives on the flat panel background">
        <PrimitiveStates />
      </section>
    </main>
  )
}
