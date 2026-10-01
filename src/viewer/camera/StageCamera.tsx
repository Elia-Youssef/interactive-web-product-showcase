import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import { PerspectiveCamera } from 'three'
import type { DistanceRange } from '@lib/camera/limits'
import { useAppStoreApi } from '@store/index'
import type { CameraPlan } from './productPlan'
import { StageCameraContext, type StageCameraApi } from './StageCameraContext'
import {
  presentPlan,
  releasePresentation,
  stepZoomBy,
  transitionToView,
  type StageCameraState,
} from './stageCameraApi'
import { useCameraControlsConfig } from './useCameraControlsConfig'
import { useCameraAutomationSource } from './useCameraAutomationSource'
import { useCameraReadoutPublish, useCameraRequests } from './useCameraStoreBridge'
import { useCameraResize } from './useCameraResize'
import { useStageAspect } from './useStageAspect'

type StageCameraProps = {
  // The scene content the camera presents, which reaches the camera API
  // through the context below.
  readonly children?: ReactNode
}

// The stage camera: drei's CameraControls is the one owner of the stage
// camera. It is mounted once, outside the product, and it is the only code
// that moves the camera. It presents the product's plan, executes the UI's
// requests from the store's camera channel, publishes the live readouts to
// the store, keeps the view through a resize, and reads itself into the
// stage's automation slot. The wiring lives in the hooks beside this file;
// the component only mounts the controls and hands the API out.
export function StageCamera({ children }: StageCameraProps) {
  const [controls, setControls] = useState<CameraControlsImpl | null>(null)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const store = useAppStoreApi()

  const planRef = useRef<CameraPlan | null>(null)
  const appliedRangeRef = useRef<DistanceRange | null>(null)
  const stageAspect = useStageAspect()

  useCameraControlsConfig(controls)
  useCameraReadoutPublish(controls, store)
  useCameraRequests(controls, camera, store, planRef, stageAspect, invalidate)
  useCameraResize(controls, size, planRef, appliedRangeRef, invalidate)
  useCameraAutomationSource(controls, camera instanceof PerspectiveCamera ? camera : null)

  const state = useMemo<StageCameraState>(
    () => ({
      controls,
      camera,
      planRef,
      appliedRangeRef,
      stageAspect,
      invalidate,
    }),
    [controls, camera, stageAspect, invalidate],
  )
  const api = useMemo<StageCameraApi>(
    () => ({
      present: (plan, viewId) => presentPlan(state, plan, viewId),
      transitionTo: (viewId) => transitionToView(state, viewId),
      zoomStep: (direction) => stepZoomBy(state, direction),
      release: () =>
        releasePresentation(state, () => store.getState().cameraPublishReadout({ kind: 'idle' })),
    }),
    [state, store],
  )

  return (
    <StageCameraContext.Provider value={api}>
      <CameraControls ref={setControls} makeDefault />
      {children}
    </StageCameraContext.Provider>
  )
}
