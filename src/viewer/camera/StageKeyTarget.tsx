import { useCallback, useId, type KeyboardEvent } from 'react'
import { stageKeyAction, type StageKeyAction } from '@lib/camera/keyMap'
import { orbitTurnOf } from '@lib/camera/orbitStep'
import { siteCopy } from '@lib/copy/site'
import { selectCameraLive, useAppStoreApi, type AppState } from '@store/index'
import { stageCameraConfig } from './config'
import styles from './StageKeyTarget.module.css'
import { bindStagePointerGestures } from './bindStagePointerGestures'
import { useStagePointerGestures } from '../stagePointerGesturesContext'

// The stage's keyboard target: one focusable leaf over the canvas life it
// belongs to, which takes the stage's keys while it holds focus. The arrows
// turn the product the way a drag does, plus and minus zoom, Home resets,
// through the same store requests the stage controls make, so the camera
// merges a held key's repeats into one move per frame. The keys act only
// on the target itself and only while a view is presented: a focused
// marker keeps its own keys, and a key the stage does not take, or one
// held with Ctrl, Alt or Meta, is left to the browser, Tab included, so
// focus always leaves. Single character keys act only here, never on the
// document. The target is an application, the role that hands the arrow
// keys to the page under a screen reader, named like the stage and
// described by its keys; it ignores the pointer, so a drag still reaches
// the canvas beneath. Its focus ring is drawn inside the stage, which
// clips what passes its edges, at an inset the stage chrome never covers.
export function StageKeyTarget() {
  const store = useAppStoreApi()
  const gestures = useStagePointerGestures()
  const descriptionId = useId()
  const attach = useCallback(
    (target: HTMLDivElement | null) => {
      if (target === null) {
        return undefined
      }
      const canvas = target.parentElement?.querySelector('canvas')
      if (canvas === undefined || canvas === null) {
        throw new Error('the stage keyboard target must mount beside its canvas')
      }
      return bindStagePointerGestures(canvas, target, gestures)
    },
    [gestures],
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }
    const action = stageKeyAction(event)
    if (action === null || !selectCameraLive(store.getState())) {
      return
    }
    event.preventDefault()
    runStageKeyAction(store.getState(), action)
  }

  return (
    <>
      <div
        ref={attach}
        className={styles.target}
        tabIndex={0}
        role="application"
        aria-label={siteCopy.stageLabel}
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
        data-stage-keys
      />
      <span id={descriptionId} hidden>
        {siteCopy.stageKeysDescription}
      </span>
    </>
  )
}

// The store request one key action makes.
export function runStageKeyAction(state: AppState, action: StageKeyAction): void {
  switch (action.kind) {
    case 'rotate':
      state.cameraRequest({
        kind: 'rotate',
        ...orbitTurnOf(action.direction, action.size, stageCameraConfig),
      })
      return
    case 'zoom':
      state.cameraRequest({ kind: 'zoom', steps: action.steps })
      return
    case 'reset':
      state.stageReset()
      return
  }
}
