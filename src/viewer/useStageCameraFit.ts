import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera } from 'three'
import { fitDistance } from '@lib/camera/fit'
import { asError } from '@lib/errors'
import type { ModelFrame } from './modelFrame'
import { useStageSettle } from './stageSettleContext'

// Frames the stage's default camera on a model's bounding sphere, once per
// measure: the pure fit rule computes the distance, the camera moves onto the
// sphere's axis at that distance and looks at the centered model, and the
// settle renders it under demand mode. The viewport aspect belongs to the
// frame, so a resize re-applies the same rule; without a settle of its own, a
// model that loaded after the last frame would never appear.
//
// The fit reads the viewport's width and height, not the size object R3F
// rebuilds on every resize observation: an observation that changed only the
// box's position would re-run the fit and render a frame the stage owes
// nothing. The settle's failure reaches the onFail callback, on a re-fit
// included: the caller owns the failure channel, so a live settle failure
// ends in a typed state and never as an unhandled rejection. A failure after
// the effect's cleanup dies with the stage that was settling.
export function useStageCameraFit(frame: ModelFrame, onFail: (error: Error) => void): void {
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const settleScene = useStageSettle()

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) {
      throw new Error('the stage frames the perspective camera R3F provides by default')
    }
    const distance = fitDistance({
      radius: frame.radius,
      fovY: MathUtils.degToRad(camera.fov),
      aspect: width / height,
    })
    // The model component centers the model on the origin, so the camera
    // frames it from there, along the default view axis.
    camera.position.set(0, 0, distance)
    camera.lookAt(0, 0, 0)
    let cancelled = false
    settleScene().then(undefined, (cause: unknown) => {
      if (!cancelled) {
        onFail(asError(cause))
      }
    })
    return () => {
      cancelled = true
    }
  }, [camera, width, height, settleScene, frame, onFail])
}
