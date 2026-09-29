// The four corner overlays of the stage: 360 label, angle readout slot,
// rotation hint, and zoom/reset controls slot.
// Words come from siteCopy. Primitives come from @ui.

import type { ReactNode } from 'react'
import { Eyebrow, Readout } from '@ui/index'
import { siteCopy } from '@lib/copy/site'
import styles from './StageChrome.module.css'

export type StageChromeProps = {
  readonly angleReadout?: ReactNode
  readonly stageControls?: ReactNode
}

export function StageChrome({ angleReadout, stageControls }: StageChromeProps) {
  return (
    <div className={styles.chrome}>
      <div className={styles.topLeft} data-corner="top-left">
        <Eyebrow>{siteCopy.stageLabel}</Eyebrow>
      </div>
      <div className={styles.topRight} data-corner="top-right" data-slot="angle-readout">
        {angleReadout}
      </div>
      <div className={styles.bottomLeft} data-corner="bottom-left">
        <Readout>{siteCopy.stageHint}</Readout>
      </div>
      <div className={styles.bottomRight} data-corner="bottom-right" data-slot="stage-controls">
        {stageControls}
      </div>
    </div>
  )
}
