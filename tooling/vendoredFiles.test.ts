import { expect, test } from 'vitest'
import { BASIS_TRANSCODER_FILES } from '../scripts/basisAssets.ts'
import { isVendoredFile, notVendored } from './vendoredFiles.ts'

test('the vendored transcoder copies are excluded, whatever their extension', () => {
  for (const file of BASIS_TRANSCODER_FILES) {
    expect(isVendoredFile(`public/basis/${file}`), `public/basis/${file}`).toBe(true)
  }
})

test('owned sources are not vendored', () => {
  expect(notVendored('src/viewer/Stage.tsx')).toBe(true)
  expect(notVendored('scripts/basisAssets.ts')).toBe(true)
  expect(notVendored('public/models/placeholder-speaker/model.glb')).toBe(true)
})
