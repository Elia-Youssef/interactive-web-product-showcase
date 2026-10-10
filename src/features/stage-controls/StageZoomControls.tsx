// The stage chrome's controls: zoom out, the live zoom percentage, zoom in,
// and Reset on one surface pill. The zoom buttons ask the store's camera
// channel to zoom by a step, and Reset asks the store to reset the stage,
// which closes any open hotspot card and returns to the home view; the
// stage camera executes the requests, so the pill is the same on both
// backends and tracks whichever product is presented. Each zoom button
// waits disabled exactly while its step would move nothing, read from the
// distance the camera's move ends at and the limits it enforces, so the
// bounds are announced, never guessed from the live distance, which rests
// within the controls' own threshold of its end. Under 640px the pinch
// zooms, so the buttons and the percentage drop and Reset stays.

import { zoomPercentOfDistance, zoomStepMoves } from '@lib/camera/zoom'
import { siteCopy } from '@lib/copy/site'
import { selectCameraReadout, useAppStore } from '@store/index'
import { IconButton, MinusIcon, PlusIcon, Readout, TextButton } from '@ui/index'
import { zoomReadoutText } from '@lib/copy/stageReadouts'
import styles from './stage-controls.module.css'

export function StageZoomControls() {
  const readout = useAppStore(selectCameraReadout)
  const cameraRequest = useAppStore((state) => state.cameraRequest)
  const stageReset = useAppStore((state) => state.stageReset)

  if (readout.kind !== 'live') {
    return null
  }
  const range = { min: readout.minDistance, max: readout.maxDistance }
  const percent = zoomPercentOfDistance(readout.distance, range)

  return (
    <div className={styles.pill}>
      <span className={styles.zoom}>
        <IconButton
          aria-label={siteCopy.zoomOutLabel}
          disabled={!zoomStepMoves(readout.endDistance, range, -1)}
          onClick={() => cameraRequest({ kind: 'zoom', steps: -1 })}
        >
          <MinusIcon />
        </IconButton>
        <Readout>{zoomReadoutText(percent)}</Readout>
        <IconButton
          aria-label={siteCopy.zoomInLabel}
          disabled={!zoomStepMoves(readout.endDistance, range, 1)}
          onClick={() => cameraRequest({ kind: 'zoom', steps: 1 })}
        >
          <PlusIcon />
        </IconButton>
      </span>
      <TextButton onClick={stageReset}>{siteCopy.resetLabel}</TextButton>
    </div>
  )
}
