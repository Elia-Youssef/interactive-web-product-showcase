import { useEffect } from 'react'
import { CameraControlsImpl } from '@react-three/drei'
import { stageCameraConfig } from './config'

// The controls' fixed configuration, applied once they exist, from the one
// camera config: rotate on left drag and one-finger touch, dolly on wheel,
// middle drag and two-finger pinch, and no truck on any input. The
// controls start disabled: no product view is presented until one is.
export function useCameraControlsConfig(controls: CameraControlsImpl | null): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    const action = CameraControlsImpl.ACTION
    controls.smoothTime = stageCameraConfig.transitionSmoothTimeSeconds
    controls.draggingSmoothTime = stageCameraConfig.draggingSmoothTimeSeconds
    controls.dollySpeed = stageCameraConfig.wheelDollySpeed
    controls.dollyToCursor = false
    controls.infinityDolly = false
    controls.mouseButtons = {
      left: action.ROTATE,
      middle: action.DOLLY,
      wheel: action.DOLLY,
      right: action.NONE,
    }
    // Two-finger pinch dollies, and a third finger keeps dollying: no
    // gesture trucks, so the orbit target stays the presented view's.
    controls.touches = {
      one: action.TOUCH_ROTATE,
      two: action.TOUCH_DOLLY,
      three: action.TOUCH_DOLLY,
    }
    controls.enabled = false
  }, [controls])
}
