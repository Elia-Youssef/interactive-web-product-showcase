import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import {
  Box3,
  MathUtils,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from 'three/webgpu'
import { useStageFrame } from '../stageFrameContext'
import { ControlsFrameClock } from './controlsFrameClock'
import { useControlsDemand } from './useControlsDemand'
import type { CameraRequestCompletion } from '@lib/camera/requestCompletion'

// The stage's controls mount: one camera-controls instance per stage,
// mounted in the stage's own component so the controls' frame step is ours
// to compute. The frame step comes from the controls' frame clock: a move
// ends an idle at its own start event, so the first frame after an idle
// steps the move's age, and a running motion steps by the frame gap,
// whatever move-start events its input steps fire on the way.

// The subset of three the controls are installed with, so the class sees
// exactly the classes the app's one three build carries.
const CONTROLS_THREE = {
  Box3,
  MathUtils: { clamp: MathUtils.clamp },
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
}

export function useStageControls(completion: CameraRequestCompletion): CameraControlsImpl {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const events = useThree((state) => state.events)

  const controls = useMemo(() => {
    CameraControlsImpl.install({ THREE: CONTROLS_THREE })
    return new CameraControlsImpl(camera)
  }, [camera])

  // One clock per mount, one frame step per frame at negative priority, so
  // the controls update ahead of the scene's own frame work.
  // The update's own return value, whether it moved anything, goes back
  // into the clock as the asleep signal the next step reads. The step runs
  // on the stage's frame path, like every frame callback of the stage: an
  // update that throws halts the frames and reaches the owner of the frames
  // instead of escaping the engine's frame loop.
  const frameClock = useMemo(() => new ControlsFrameClock(), [])
  useStageFrame(
    'stage',
    () => {
      const step = frameClock.stepSeconds(performance.now())
      const updated = controls.update(step)
      frameClock.recordUpdate(updated)
      completion.updated(updated)
    },
    -1,
  )

  // The controls listen on the canvas element the stage's event system is
  // connected to, and let go of it with the mount.
  useEffect(() => {
    const domElement = events.connected ?? gl.domElement
    controls.connect(domElement)
    return () => void controls.disconnect()
  }, [controls, events, gl])

  useControlsDemand(controls, frameClock, completion, invalidate)

  return controls
}
