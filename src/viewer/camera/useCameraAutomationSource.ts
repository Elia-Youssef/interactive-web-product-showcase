import { useEffect } from 'react'
import type { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, Vector3, type PerspectiveCamera } from 'three'
import type { ViewerCameraAutomation } from '../automation/viewerAutomation'
import { useStageProbes } from '../automation/stageProbesContext'

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
  // The orbit target from the controls' end state: the public getter's
  // receiveEndValue default, spelled out so the read's meaning stays in it
  // (camera-controls dist/index.d.ts).
  const endTarget = controls.getTarget(new Vector3(), true)
  return {
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: endTarget.x, y: endTarget.y, z: endTarget.z },
    fovY: MathUtils.degToRad(camera.fov),
    azimuth: controls.azimuthAngle,
    polar: controls.polarAngle,
    distance: controls.distance,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  }
}
