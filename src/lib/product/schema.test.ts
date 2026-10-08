import { describe, expect, it } from 'vitest'
import { ManifestError } from './errors'
import { sampleThreeManifest, sampleTwoManifest } from './fixtures'
import type { ManifestCase } from './manifestCases/case'
import { finishCases } from './manifestCases/finishes'
import { hotspotCases } from './manifestCases/hotspots'
import { identityCases } from './manifestCases/identity'
import { lookCases } from './manifestCases/look'
import { metaCases } from './manifestCases/meta'
import { optionCases } from './manifestCases/options'
import { parseProduct } from './parse'
import { DEFAULT_EXPLODE_CLIP } from './rules'

// The case tables live in manifestCases/, one module per concern. Every table
// runs through the same assertions below.
const casesByConcern: ReadonlyArray<readonly [string, readonly ManifestCase[]]> = [
  ['identity and copy', identityCases],
  ['finishes', finishCases],
  ['hotspots', hotspotCases],
  ['explode and camera', optionCases],
  ['look', lookCases],
  ['meta', metaCases],
]

function manifestErrorThrown(manifest: unknown): ManifestError {
  try {
    parseProduct(manifest, 'test')
  } catch (error) {
    if (error instanceof ManifestError) {
      return error
    }
    throw error
  }
  throw new Error('expected the manifest to be rejected')
}

for (const [concern, cases] of casesByConcern) {
  describe(`parseProduct against the manifest schema: ${concern}`, () => {
    for (const testCase of cases) {
      it(`${testCase.accepted ? 'accepts' : 'rejects'} ${testCase.name}`, () => {
        if (testCase.accepted) {
          expect(parseProduct(testCase.manifest, 'test').slug).toEqual(testCase.slug)
          return
        }
        const error = manifestErrorThrown(testCase.manifest)
        expect(error.issues.map((issue) => issue.path)).toContain(testCase.path)
        expect(error.message).toContain(testCase.path)
      })
    }
  })
}

describe('the explode block is normalized to carry its clip', () => {
  const cases: ReadonlyArray<{ name: string; manifest: unknown; explode: unknown }> = [
    {
      name: 'an absent block gives the default clip',
      manifest: sampleTwoManifest,
      explode: { clip: DEFAULT_EXPLODE_CLIP },
    },
    {
      name: 'a label-only block keeps the default clip',
      manifest: sampleThreeManifest,
      explode: { clip: DEFAULT_EXPLODE_CLIP, label: 'See inside' },
    },
    {
      name: 'an explicit clip is kept',
      manifest: { ...sampleTwoManifest, explode: { clip: 'Open up' } },
      explode: { clip: 'Open up' },
    },
  ]

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(parseProduct(testCase.manifest, 'test').explode).toEqual(testCase.explode)
    })
  }
})
