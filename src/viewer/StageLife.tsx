import { StagePointerGestures } from '@lib/input/StagePointerGestures'
import { StagePointerGesturesContext } from './stagePointerGesturesContext'
import { useEffect, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useStageProbes } from './automation/stageProbesContext'
import { StageOverlay } from './overlay/StageOverlay'
import { StageOverlayContext } from './overlay/stageOverlayContext'
import { StageKeyTarget } from './camera/StageKeyTarget'
import styles from './StageLife.module.css'

type StageLifeProps = {
  // The canvas of this life, or null for a stage that mounts none.
  readonly canvas: ReactElement | null
  // The DOM content shown over the canvas, or nothing.
  readonly overlay?: ReactNode
}

// One canvas life of the stage, mounted under the key of the life's epoch:
// the canvas, and the overlay channel and overlay content that belong to it.
// A placement is a projection measured on one canvas and written by that
// canvas's post-present phase, so it is a fact of that canvas alone. The
// overlay channel therefore lives exactly as long as the canvas: when a
// retired renderer is replaced, the fresh canvas arrives with a fresh
// channel that holds no placement of the retired one, every overlay element
// mounts on it hidden, and only a pass the fresh canvas presented places
// it. No stale marker can outlive the canvas it was measured on, whatever
// the order the fresh content mounts in. The life registers the stage's
// overlay probe for as long as it is mounted, so the automation reads the
// channel of the canvas on the stage now. A life with a canvas carries the
// stage's keyboard target, ahead of the overlay in the focus order, so Tab
// reaches the stage before the markers on it. The overlay box carries the
// stage overlay mark: everything inside it is the product's own content
// laid over the canvas, apart from whatever a page lays over the stage
// beside it.
export function StageLife({ canvas, overlay }: StageLifeProps) {
  const [channel] = useState(() => new StageOverlay())
  const [gestures] = useState(() => new StagePointerGestures())
  const probes = useStageProbes()

  useEffect(
    () => probes.register('overlay', () => ({ placements: channel.placementRecord() })),
    [probes, channel],
  )

  return (
    <StagePointerGesturesContext.Provider value={gestures}>
      <StageOverlayContext.Provider value={channel}>
        {canvas}
        {canvas !== null && <StageKeyTarget />}
        {overlay !== undefined && (
          <div className={styles.overlay} data-stage-overlay>
            {overlay}
          </div>
        )}
      </StageOverlayContext.Provider>
    </StagePointerGesturesContext.Provider>
  )
}
