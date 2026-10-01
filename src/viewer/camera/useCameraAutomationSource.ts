import { useEffect } from 'react'
import type { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, type PerspectiveCamera } from 'three'
import type { ViewerCameraAutomation, ViewerCameraSource } from '../automation/viewerAutomation'
import type { CameraSourceSlot } from './cameraSource'
import { readControlsEndState } from './controls'

// The live camera read for the automation hook, registered into the stage's
// slot for the controls' lifetime: every value is read from the camera and
// the controls themselves at access time, the orbit target from the
// controls' own end state, never from the store's copy of the readouts.
export function useCameraAutomationSource(
  controls: CameraControlsImpl | null,
  camera: PerspectiveCamera | null,
  cameraSlot: CameraSourceSlot,
): void {
  useEffect(() => {
    if (controls === null || camera === null) {
      return
    }
    const readCamera = (): ViewerCameraAutomation => {
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
    const source: ViewerCameraSource = readCamera
    cameraSlot.register(source)
    return () => cameraSlot.register(null)
  }, [controls, camera, cameraSlot])
}
