import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera } from 'three'
import { fitDistance } from '@lib/camera/fit'
import type { ModelFrame } from './modelFrame'

// Frames the stage's default camera on a model's bounding sphere, once per
// measure: the pure fit rule computes the distance, the camera moves onto the
// sphere's axis at that distance and looks at the centered model, and the
// invalidation renders it under demand mode. The viewport aspect belongs to
// the frame, so a resize re-applies the same rule; without an invalidation of
// its own, a model that loaded after the last frame would never appear.
export function useStageCameraFit(frame: ModelFrame): void {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) {
      throw new Error('the stage frames the perspective camera R3F provides by default')
    }
    const distance = fitDistance({
      radius: frame.radius,
      fovY: MathUtils.degToRad(camera.fov),
      aspect: size.width / size.height,
    })
    // The model component centers the model on the origin, so the camera
    // frames it from there, along the default view axis.
    camera.position.set(0, 0, distance)
    camera.lookAt(0, 0, 0)
    invalidate()
  }, [camera, size, invalidate, frame])
}
