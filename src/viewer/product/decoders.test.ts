import { expect, test } from 'vitest'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { productKtx2Loader } from './decoders'

// The KTX2 loader resolves its transcoder from its own URL references when
// its transcoder path is empty: those references are what the bundler emits
// as the one content-hashed pair, so a configured path would ship a second
// pair or fetch one the build never emits.
test('the product KTX2 loader keeps its bundled default transcoder path', () => {
  const pristine = new KTX2Loader()
  expect(pristine.transcoderPath).toBe('')
  expect(productKtx2Loader().transcoderPath).toBe(pristine.transcoderPath)
})
