import { useEffect, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { useStageFrame } from '@viewer/stageFrameContext'
import { prefersReducedMotion } from '@lib/motion/reducedMotion'
import type { ExplodeDriver } from './explodeDriver'
import { explodeFrame, stepExplodeFrame } from './explodeFrame'

// The exploded view's motion, as two thin calls on the driver. The
// retarget effect hands the render's target to the driver; the frame step
// reads the driver's own anchored target, never the render's, so a frame
// that runs between the commit and the effect steps the old anchor toward
// its own target and the retarget re-anchors before any frame owes the
// new one. The driver answers whether a frame is owed; at rest it owes
// none and demand mode renders nothing. The frame step runs on the stage's
// frame path as the presented product's code, at its stated place in the
// frame.
export function useExplodeMotion(driverRef: RefObject<ExplodeDriver | null>, target: number): void {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    const driver = driverRef.current
    if (driver === null) {
      return
    }
    if (driver.retarget(target, performance.now(), prefersReducedMotion())) {
      invalidate()
    }
  }, [driverRef, target, invalidate])

  useStageFrame(
    explodeFrame.scope,
    () => stepExplodeFrame(driverRef.current, performance.now(), invalidate),
    explodeFrame.priority,
  )
}
