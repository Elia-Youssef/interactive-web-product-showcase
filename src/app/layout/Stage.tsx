// The 3D stage area of the desktop layout: backdrop grid, canvas slot,
// and corner chrome. Words come from siteCopy.

import { useState } from 'react'
import type { ReactNode } from 'react'
import backdropStyles from '@styles/StageBackdrop.module.css'
import { siteCopy } from '@lib/copy/site'
import { createStageSurface } from '@viewer/stageSurface'
import { StageSurfaceContext, useStageSurfaceElement } from '@viewer/stageSurfaceContext'
import { StageChrome } from './StageChrome'
import styles from './Stage.module.css'

export type StageProps = {
  readonly children?: ReactNode
  readonly angleReadout?: ReactNode
  readonly stageControls?: ReactNode
}

export function Stage({ children, angleReadout, stageControls }: StageProps) {
  // The stage surface, one per mount: this section element binds to it, and
  // the canvas content claims its custom properties through the context,
  // which R3F bridges into the canvas.
  const [surface] = useState(createStageSurface)
  const bindSurface = useStageSurfaceElement(surface)

  return (
    <StageSurfaceContext.Provider value={surface}>
      <section ref={bindSurface} className={styles.stage} aria-label={siteCopy.stageLabel}>
        <div className={backdropStyles.backdrop} data-testid="stage-backdrop" />
        <div className={styles.canvasSlot} data-slot="stage">
          {children}
        </div>
        <StageChrome angleReadout={angleReadout} stageControls={stageControls} />
      </section>
    </StageSurfaceContext.Provider>
  )
}
