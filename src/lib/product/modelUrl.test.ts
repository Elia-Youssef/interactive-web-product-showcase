import { expect, test } from 'vitest'
import { productModelUrl } from './modelUrl'

test('the model URL is the product folder under public/models', () => {
  expect(productModelUrl('sample-one')).toBe('/models/sample-one/model.glb')
})

test('every slug maps to its own model file', () => {
  expect(productModelUrl('sample-one')).not.toBe(productModelUrl('sample-two'))
  expect(productModelUrl('sample-two')).toBe('/models/sample-two/model.glb')
})
