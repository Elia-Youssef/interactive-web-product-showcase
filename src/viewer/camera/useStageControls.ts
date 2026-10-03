import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControlsImpl } from '@react-three/drei'
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
} from 'three'
import { useStageFrame } from '../stageFrameContext'
import { ControlsFrameClock } from './controlsFrameClock'

// The stage's controls mount: the same camera-controls instance drei's
// CameraControls component builds (its core/CameraControls.js), mounted in
// the stage's own component so the controls' frame step is ours to compute.
// The frame step comes from the controls' frame clock: a move ends an idle
// at its own start event, so the first frame after an idle steps the move's
// age, and a running motion steps by the frame gap, whatever move-start
// events its input steps fire on the way.

// The subset of three the controls are installed with, the same subset
// drei installs for tree shaking.
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

export function useStageControls(): CameraControlsImpl {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const events = useThree((state) => state.events)

  const controls = useMemo(() => {
    CameraControlsImpl.install({ THREE: CONTROLS_THREE })
    return new CameraControlsImpl(camera)
  }, [camera])

  // One clock per mount, one frame step per frame at the priority drei's
  // component updates the controls at: ahead of the scene's own frame work.
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
      frameClock.recordUpdate(controls.update(step))
    },
    -1,
  )

  // The controls listen on the canvas element drei connects to, and let go
  // of it with the mount.
  useEffect(() => {
    const domElement = events.connected ?? gl.domElement
    controls.connect(domElement)
    return () => void controls.disconnect()
  }, [controls, events, gl])

  // The demand frame loop renders on the controls' own events. The
  // move-start events, transitionstart and controlstart, also timestamp the
  // move's start; camera-controls fires them on every applied input step,
  // and the clock anchors on them only while the controls were asleep.
  useEffect(() => {
    const beginMove = () => {
      frameClock.beginMove(performance.now())
      invalidate()
    }
    const invalidateOnly = () => invalidate()
    controls.addEventListener('controlstart', beginMove)
    controls.addEventListener('transitionstart', beginMove)
    controls.addEventListener('control', invalidateOnly)
    controls.addEventListener('update', invalidateOnly)
    controls.addEventListener('wake', invalidateOnly)
    return () => {
      controls.removeEventListener('controlstart', beginMove)
      controls.removeEventListener('transitionstart', beginMove)
      controls.removeEventListener('control', invalidateOnly)
      controls.removeEventListener('update', invalidateOnly)
      controls.removeEventListener('wake', invalidateOnly)
    }
  }, [controls, frameClock, invalidate])

  return controls
}
