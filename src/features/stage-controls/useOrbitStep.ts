// The stage controls' orbit step: one press asks the store's camera
// channel for one coarse turn in a direction, the same turn its arrow key
// asks for, at the step sizes of the camera config. The camera merges the
// presses of one frame, so a button held on the keyboard costs one move
// per frame.

import { orbitTurnOf, type OrbitDirection } from '@lib/camera/orbitStep'
import { useAppStore } from '@store/index'
import { stageCameraConfig } from '@viewer/camera/config'

export function useOrbitStep(): (direction: OrbitDirection) => void {
  const cameraRequest = useAppStore((state) => state.cameraRequest)
  return (direction) =>
    cameraRequest({ kind: 'rotate', ...orbitTurnOf(direction, 'coarse', stageCameraConfig) })
}
