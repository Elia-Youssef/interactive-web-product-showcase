// The stage chrome's angle row: the live azimuth of the stage camera as
// `NNN / 360`, with a rotate button either side, in the collection
// navigation row's pattern: `< 127 / 360 >`. Each button turns the product
// one rotate step the way a drag does: rotate right turns it to the right.
// The row sits empty while no product view is presented, so the corner
// carries nothing that could go stale and no button that could ask a
// camera with no view to move.

import { normalizedAzimuthDegrees } from '@lib/camera/azimuth'
import type { OrbitDirection } from '@lib/camera/orbitStep'
import { siteCopy } from '@lib/copy/site'
import { selectCameraReadout, useAppStore } from '@store/index'
import { ChevronLeftIcon, ChevronRightIcon, IconButton, Readout } from '@ui/index'
import { angleReadoutText } from '@lib/copy/stageReadouts'
import { useOrbitStep } from './useOrbitStep'
import styles from './stage-controls.module.css'

export type StageAngleRowProps = {
  // The controls' accumulated azimuth, in radians.
  readonly azimuth: number
  readonly onRotate: (direction: Extract<OrbitDirection, 'left' | 'right'>) => void
}

// The row alone, from plain values, for the static render.
export function StageAngleRow({ azimuth, onRotate }: StageAngleRowProps) {
  return (
    <span className={styles.angle}>
      <IconButton aria-label={siteCopy.rotateLeftLabel} onClick={() => onRotate('left')}>
        <ChevronLeftIcon />
      </IconButton>
      <Readout>{angleReadoutText(normalizedAzimuthDegrees(azimuth))}</Readout>
      <IconButton aria-label={siteCopy.rotateRightLabel} onClick={() => onRotate('right')}>
        <ChevronRightIcon />
      </IconButton>
    </span>
  )
}

export function StageAngleReadout() {
  const readout = useAppStore(selectCameraReadout)
  const orbitStep = useOrbitStep()

  if (readout.kind !== 'live') {
    return null
  }
  return <StageAngleRow azimuth={readout.azimuth} onRotate={orbitStep} />
}
