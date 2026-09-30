import { expect, test } from 'vitest'
import { createAppStore } from './createAppStore'

test('a fresh store starts with the renderer initializing', () => {
  const store = createAppStore()

  expect(store.getState().rendererStatus).toEqual({ kind: 'initializing' })
})

test('two stores never share state', () => {
  const first = createAppStore()
  const second = createAppStore()

  first.getState().rendererReady('webgpu')
  second.getState().rendererFailed('second store lost its device')

  expect(first.getState().rendererStatus).toEqual({ kind: 'ready', backend: 'webgpu' })
  expect(second.getState().rendererStatus).toEqual({
    kind: 'failed',
    reason: 'second store lost its device',
  })
})
