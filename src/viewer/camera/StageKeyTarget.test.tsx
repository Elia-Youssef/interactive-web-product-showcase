import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { siteCopy } from '@lib/copy/site'
import { StagePointerGestures } from '@lib/input/StagePointerGestures'
import { AppStoreProvider, createAppStore, selectCameraRequestChannel } from '@store/index'
import { StagePointerGesturesContext } from '../stagePointerGesturesContext'
import { runStageKeyAction, StageKeyTarget } from './StageKeyTarget'
import { stageCameraConfig } from './config'

// The stage key target: its markup, and the store request each key action
// makes, against a real store. The key map itself is pure data with its
// own test; the browser behavior (focus, the keys reaching the camera, the
// keys it leaves alone) is the keyboard orbit spec's.

describe('StageKeyTarget', () => {
  it('renders one focusable application named like the stage and described by its keys', () => {
    const html = renderToString(
      <AppStoreProvider>
        <StagePointerGesturesContext.Provider value={new StagePointerGestures()}>
          <StageKeyTarget />
        </StagePointerGesturesContext.Provider>
      </AppStoreProvider>,
    )
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('role="application"')
    expect(html).toContain(`aria-label="${siteCopy.stageLabel}"`)
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1]
    expect(describedBy).toBeDefined()
    expect(html).toContain(`id="${describedBy}" hidden="">${siteCopy.stageKeysDescription}<`)
  })
})

describe('runStageKeyAction', () => {
  it('asks for a coarse right turn with the sign of a right drag', () => {
    const store = createAppStore()
    runStageKeyAction(store.getState(), { kind: 'rotate', direction: 'right', size: 'coarse' })
    expect(selectCameraRequestChannel(store.getState()).request).toEqual({
      kind: 'rotate',
      azimuthDegrees: -stageCameraConfig.rotateStepDegrees,
      polarDegrees: 0,
    })
  })

  it('asks for the fine step with Shift', () => {
    const store = createAppStore()
    runStageKeyAction(store.getState(), { kind: 'rotate', direction: 'up', size: 'fine' })
    expect(selectCameraRequestChannel(store.getState()).request).toEqual({
      kind: 'rotate',
      azimuthDegrees: 0,
      polarDegrees: stageCameraConfig.fineStepDegrees,
    })
  })

  it('asks for a zoom step', () => {
    const store = createAppStore()
    runStageKeyAction(store.getState(), { kind: 'zoom', steps: -1 })
    expect(selectCameraRequestChannel(store.getState()).request).toEqual({
      kind: 'zoom',
      steps: -1,
    })
  })

  it('resets the stage: the home view, the way the Reset button asks for it', () => {
    const store = createAppStore()
    runStageKeyAction(store.getState(), { kind: 'reset' })
    expect(selectCameraRequestChannel(store.getState()).request).toEqual({
      kind: 'view',
      viewId: 'home',
    })
  })
})
