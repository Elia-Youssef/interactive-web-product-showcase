// The 3D stage area of the desktop layout: backdrop grid, canvas slot,
// and corner chrome. Words come from siteCopy.

import type { ReactNode } from 'react'
import backdropStyles from '@styles/StageBackdrop.module.css'
import { siteCopy } from '@lib/copy/site'
import { StageChrome } from './StageChrome'
import styles from './Stage.module.css'

export type StageProps = {
  readonly children?: ReactNode
  readonly angleReadout?: ReactNode
  readonly stageControls?: ReactNode
}

export function Stage({ children, angleReadout, stageControls }: StageProps) {
  return (
    <section className={styles.stage} aria-label={siteCopy.stageLabel}>
      <div className={backdropStyles.backdrop} />
      <div className={styles.canvasSlot} data-slot="stage">
        {children}
      </div>
      <StageChrome angleReadout={angleReadout} stageControls={stageControls} />
    </section>
  )
}
