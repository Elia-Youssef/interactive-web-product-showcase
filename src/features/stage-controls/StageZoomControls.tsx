// The stage chrome's controls: the tilt pair, then zoom out, the live zoom
// percentage, zoom in, and Reset, on one surface pill. The tilt and zoom
// buttons ask the store's camera channel for a step, and Reset asks the
// store to reset the stage, which closes any open hotspot card and returns
// to the home view; the stage camera executes the requests, so the pill is
// the same on both backends and tracks whichever product is presented.
// Each tilt and zoom button waits unavailable exactly while its step would
// move nothing, read from where the camera's move ends and the limits it
// enforces, so the bounds are announced, never guessed from the live
// values, which rest within the controls' own threshold of their end. The
// wait is announced, never the disabled attribute: the button is the
// control the visitor was pressing when it reached the limit, and the
// native attribute would drop their focus on the body. The zoom buttons
// stay on phones too: pinch is a two-finger gesture, and the buttons are
// the single-pointer way to zoom.

import type { OrbitDirection } from '@lib/camera/orbitStep'
import { tiltStepMoves } from '@lib/camera/orbitStep'
import { zoomPercentOfDistance, zoomStepMoves } from '@lib/camera/zoom'
import { siteCopy } from '@lib/copy/site'
import { selectCameraReadout, useAppStore, type LiveCameraReadout } from '@store/index'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  IconButton,
  MinusIcon,
  PlusIcon,
  Readout,
  TextButton,
} from '@ui/index'
import { zoomReadoutText } from '@lib/copy/stageReadouts'
import { useOrbitStep } from './useOrbitStep'
import styles from './stage-controls.module.css'

export type StageControlsPillProps = {
  readonly readout: LiveCameraReadout
  readonly onTilt: (direction: Extract<OrbitDirection, 'up' | 'down'>) => void
  readonly onZoom: (steps: 1 | -1) => void
  readonly onReset: () => void
}

// The pill alone, from plain values: the store-bound controls feed it, and
// a static render can reach every limit state through it.
export function StageControlsPill({ readout, onTilt, onZoom, onReset }: StageControlsPillProps) {
  const range = { min: readout.minDistance, max: readout.maxDistance }
  const polarRange = { min: readout.minPolar, max: readout.maxPolar }
  const percent = zoomPercentOfDistance(readout.distance, range)

  return (
    <div className={styles.pill}>
      <span className={styles.cluster}>
        <IconButton
          aria-label={siteCopy.tiltUpLabel}
          unavailable={!tiltStepMoves(readout.endPolar, polarRange, 'up')}
          onClick={() => onTilt('up')}
        >
          <ChevronUpIcon />
        </IconButton>
        <IconButton
          aria-label={siteCopy.tiltDownLabel}
          unavailable={!tiltStepMoves(readout.endPolar, polarRange, 'down')}
          onClick={() => onTilt('down')}
        >
          <ChevronDownIcon />
        </IconButton>
      </span>
      <span className={styles.row}>
        <span className={styles.cluster}>
          <IconButton
            aria-label={siteCopy.zoomOutLabel}
            unavailable={!zoomStepMoves(readout.endDistance, range, -1)}
            onClick={() => onZoom(-1)}
          >
            <MinusIcon />
          </IconButton>
          <Readout>{zoomReadoutText(percent)}</Readout>
          <IconButton
            aria-label={siteCopy.zoomInLabel}
            unavailable={!zoomStepMoves(readout.endDistance, range, 1)}
            onClick={() => onZoom(1)}
          >
            <PlusIcon />
          </IconButton>
        </span>
        <TextButton onClick={onReset}>{siteCopy.resetLabel}</TextButton>
      </span>
    </div>
  )
}

export function StageZoomControls() {
  const readout = useAppStore(selectCameraReadout)
  const cameraRequest = useAppStore((state) => state.cameraRequest)
  const stageReset = useAppStore((state) => state.stageReset)
  const orbitStep = useOrbitStep()

  if (readout.kind !== 'live') {
    return null
  }
  return (
    <StageControlsPill
      readout={readout}
      onTilt={orbitStep}
      onZoom={(steps) => cameraRequest({ kind: 'zoom', steps })}
      onReset={stageReset}
    />
  )
}
