import path from 'node:path'
import { expect, test } from 'vitest'
import { basisTranscoderPath } from '../src/lib/product/transcoderPath.ts'
import { basisTranscoderPath as decoderTranscoderPath } from '../src/viewer/product/decoders.ts'
import {
  BASIS_TRANSCODER_FILES,
  basisTargetDir,
  basisVendoredPrefix,
} from '../scripts/basisAssets.ts'
import { isVendoredFile, notVendored, vendoredFilePaths } from './vendoredFiles.ts'

test('the transcoder location is spelled once and derived everywhere else', () => {
  // The contract value: the transcoder lives under /basis/, served from
  // public/basis and vendored there. A move of the location is a change of
  // this pin and of nothing else.
  expect(basisTranscoderPath).toBe('/basis/')
  // scripts derives the served folder from the URL path.
  expect(basisTargetDir('repo')).toBe(path.join('repo', 'public', basisTranscoderPath))
  // tooling derives the vendored prefix from the same URL path.
  expect(basisVendoredPrefix).toBe(`public${basisTranscoderPath}`)
  expect(vendoredFilePaths).toContain(basisVendoredPrefix)
  // the runtime decoder wiring points at the same URL path.
  expect(decoderTranscoderPath).toBe(basisTranscoderPath)
})

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
