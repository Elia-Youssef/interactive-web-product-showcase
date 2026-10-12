import { useCallback, useContext, useEffect } from 'react'
import type CameraControls from 'camera-controls'
import type { CameraRequestCompletion } from '@lib/camera/requestCompletion'
import { selectCameraOutcome, selectCameraRequestChannel, useAppStoreApi } from '@store/index'
import { StageSettleContext } from '../stageSettleContext'
import { usePresentedFrame } from '../stageFrameContext'
import { useStageProbes } from '../automation/stageProbesContext'

export function useCameraCompletion(
  completion: CameraRequestCompletion,
  controls: CameraControls,
): void {
  const store = useAppStoreApi()
  const settle = useContext(StageSettleContext)
  const probes = useStageProbes()
  if (settle === null) throw new Error('camera completion requires the stage settle owner')
  const readPose = useCallback(
    () => ({
      azimuth: controls.azimuthAngle,
      polar: controls.polarAngle,
      distance: controls.distance,
    }),
    [controls],
  )
  const presented = useCallback(() => {
    completion.presented(selectCameraRequestChannel(store.getState()).sequence, readPose)
  }, [completion, readPose, store])
  usePresentedFrame('stage', presented)
  useEffect(
    () =>
      probes.register('completion', () => {
        const state = store.getState()
        return completion.read(
          selectCameraRequestChannel(state).sequence,
          selectCameraOutcome(state)?.sequence ?? 0,
          settle.pending,
        )
      }),
    [completion, probes, settle, store],
  )
}
