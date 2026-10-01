import { useEffect } from 'react'
import type { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, type PerspectiveCamera } from 'three'
import type { ViewerCameraAutomation } from '../automation/viewerAutomation'
import { useStageProbes } from '../automation/stageProbesContext'
import { readControlsEndState } from './controls'

// The live camera read for the automation hook, registered into the stage's
// probes for the controls' lifetime: every value is read from the camera
// and the controls themselves at access time, the orbit target from the
// controls' own end state, never from the store's copy of the readouts.
export function useCameraAutomationSource(
  controls: CameraControlsImpl | null,
  camera: PerspectiveCamera | null,
): void {
  const probes = useStageProbes()
  useEffect(() => {
    if (controls === null || camera === null) {
      return
    }
    return probes.register('camera', () => readCameraAutomation(controls, camera))
  }, [controls, camera, probes])
}

function readCameraAutomation(
  controls: CameraControlsImpl,
  camera: PerspectiveCamera,
): ViewerCameraAutomation {
  const end = readControlsEndState(controls)
  return {
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: end.target[0], y: end.target[1], z: end.target[2] },
    fovY: MathUtils.degToRad(camera.fov),
    azimuth: controls.azimuthAngle,
    polar: controls.polarAngle,
    distance: controls.distance,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  }
}
