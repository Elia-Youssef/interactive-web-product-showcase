import { expect, test } from 'vitest'
import { productModelUrl } from './modelUrl'

test('the model URL is the product folder under public/models', () => {
  expect(productModelUrl('sample-one')).toBe('/models/sample-one/model.glb')
})
