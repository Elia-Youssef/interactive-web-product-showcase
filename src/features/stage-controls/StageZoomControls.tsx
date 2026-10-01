// The stage chrome's controls: zoom out, the live zoom percentage, zoom in,
// and Reset on one surface pill. The buttons ask the store's camera channel
// to zoom by a step or to return to the home view; the stage camera
// executes the requests, so the pill is the same on both backends and
// tracks whichever product is presented. Under 640px the pinch zooms, so
// the buttons and the percentage drop and Reset stays.

import { zoomPercentOfDistance } from '@lib/camera/zoom'
import { CAMERA_HOME_ID } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { selectCameraReadout, useAppStore } from '@store/index'
import { IconButton, MinusIcon, PlusIcon, Readout, TextButton } from '@ui/index'
import { zoomReadoutText } from './stage-controls.logic'
import styles from './stage-controls.module.css'

export function StageZoomControls() {
  const readout = useAppStore(selectCameraReadout)
  const cameraRequest = useAppStore((state) => state.cameraRequest)

  if (readout.kind !== 'live') {
    return null
  }
  const percent = zoomPercentOfDistance(readout.distance, {
    min: readout.minDistance,
    max: readout.maxDistance,
  })

  return (
    <div className={styles.pill}>
      <span className={styles.zoom}>
        <IconButton
          aria-label={siteCopy.zoomOutLabel}
          onClick={() => cameraRequest({ kind: 'zoom', direction: -1 })}
        >
          <MinusIcon />
        </IconButton>
        <Readout>{zoomReadoutText(percent)}</Readout>
        <IconButton
          aria-label={siteCopy.zoomInLabel}
          onClick={() => cameraRequest({ kind: 'zoom', direction: 1 })}
        >
          <PlusIcon />
        </IconButton>
      </span>
      <TextButton onClick={() => cameraRequest({ kind: 'view', viewId: CAMERA_HOME_ID })}>
        {siteCopy.resetLabel}
      </TextButton>
    </div>
  )
}
