import { useEffect, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { reducedMotionQuery } from './config'
import type { ExplodeDriver } from './explodeDriver'

// The exploded view's motion, as two thin calls on the driver. The
// retarget effect hands the render's target to the driver; the frame step
// reads the driver's own anchored target, never the render's, so a frame
// that runs between the commit and the effect steps the old anchor toward
// its own target and the retarget re-anchors before any frame owes the
// new one. The driver answers whether a frame is owed; at rest it owes
// none and demand mode renders nothing.
export function useExplodeMotion(driverRef: RefObject<ExplodeDriver | null>, target: number): void {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    const driver = driverRef.current
    if (driver === null) {
      return
    }
    if (driver.retarget(target, performance.now(), window.matchMedia(reducedMotionQuery).matches)) {
      invalidate()
    }
  }, [driverRef, target, invalidate])

  useFrame(() => {
    const driver = driverRef.current
    if (driver === null) {
      return
    }
    if (driver.step(performance.now())) {
      invalidate()
    }
  })
}
