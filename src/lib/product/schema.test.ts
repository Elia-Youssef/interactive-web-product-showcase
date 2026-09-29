import { describe, expect, it } from 'vitest'
import { ManifestError } from './errors'
import { sampleOneManifest, sampleTwoManifest } from './fixtures'
import type { ManifestCase } from './manifestCases/case'
import { finishCases } from './manifestCases/finishes'
import { hotspotCases } from './manifestCases/hotspots'
import { identityCases } from './manifestCases/identity'
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

describe('the explode clip default', () => {
  it('fills in the default clip in the parsed output', () => {
    const product = parseProduct({ ...sampleOneManifest, explode: {} }, 'test')
    expect(product.explode?.clip).toEqual(DEFAULT_EXPLODE_CLIP)
  })

  it('leaves explode undefined when the manifest has none', () => {
    expect(parseProduct(sampleTwoManifest, 'test').explode).toBeUndefined()
  })

  it('keeps a given clip', () => {
    const product = parseProduct(sampleOneManifest, 'test')
    expect(product.explode).toEqual({ clip: 'Explode', label: 'See inside' })
  })
})
