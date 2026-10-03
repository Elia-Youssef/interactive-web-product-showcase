import { expect, test } from 'vitest'
import type { ProductFailure } from '@lib/product'
import { createAppStore } from './createAppStore'

const missingModel: ProductFailure = {
  kind: 'load',
  url: '/models/sample-two/model.glb',
  message: 'the model is missing',
}

test('a fresh store starts with the renderer initializing and the product idle', () => {
  const store = createAppStore()

  expect(store.getState().rendererStatus).toEqual({ kind: 'initializing' })
  expect(store.getState().productStatus).toEqual({ kind: 'idle' })
})

test('two stores never share state', () => {
  const first = createAppStore()
  const second = createAppStore()

  first.getState().rendererReady('webgpu')
  first.getState().productLoad('sample-one')
  second.getState().rendererFailed('second store lost its device')
  second.getState().productFailed('sample-two', missingModel)

  expect(first.getState().rendererStatus).toEqual({ kind: 'ready', backend: 'webgpu' })
  expect(first.getState().productStatus).toEqual({ kind: 'loading', slug: 'sample-one' })
  expect(second.getState().rendererStatus).toEqual({
    kind: 'failed',
    reason: 'second store lost its device',
  })
  expect(second.getState().productStatus).toEqual({
    kind: 'failed',
    slug: 'sample-two',
    failure: missingModel,
  })
})
