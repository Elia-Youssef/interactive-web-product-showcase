import { expect, test } from 'vitest'
import { rendererBackends } from '@lib/renderer/backend'
import {
  createRendererSlice,
  selectRendererBackend,
  selectRendererStatus,
  type RendererSliceState,
} from './renderer'

// A minimal set wired by hand, so the slice is tested on its own, without
// the composition around it.
function makeSlice() {
  let state: RendererSliceState = { rendererStatus: { kind: 'initializing' } }
  const slice = createRendererSlice((updater) => {
    state = { ...state, ...updater(state) }
  })

  return { slice, read: () => state }
}

test('a fresh slice starts initializing with no backend', () => {
  const { read } = makeSlice()

  expect(selectRendererStatus(read())).toEqual({ kind: 'initializing' })
  expect(selectRendererBackend(read())).toBeNull()
})

test.each(rendererBackends)('selectors report ready on %s with that backend', (backend) => {
  const { slice, read } = makeSlice()

  slice.rendererReady(backend)

  expect(selectRendererStatus(read())).toEqual({ kind: 'ready', backend })
  expect(selectRendererBackend(read())).toBe(backend)
})

test('selectors report failed with the reason and no backend', () => {
  const { slice, read } = makeSlice()

  slice.rendererFailed('context creation failed')

  expect(selectRendererStatus(read())).toEqual({
    kind: 'failed',
    reason: 'context creation failed',
  })
  expect(selectRendererBackend(read())).toBeNull()
})

test('selectors report initializing again after a reset', () => {
  const { slice, read } = makeSlice()

  slice.rendererReady('webgpu')
  slice.rendererReset()

  expect(selectRendererStatus(read())).toEqual({ kind: 'initializing' })
  expect(selectRendererBackend(read())).toBeNull()
})
