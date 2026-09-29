import { describe, expect, it } from 'vitest'
import { formatFieldPath, ManifestError } from './errors'
import { driverHotspot, sampleOneManifest, graphiteFinish } from './fixtures'
import { parseProduct } from './parse'

const SOURCE = 'broken.json'

function manifestErrorThrown(manifest: unknown, source = SOURCE): ManifestError {
  try {
    parseProduct(manifest, source)
  } catch (error) {
    if (error instanceof ManifestError) {
      return error
    }
    throw error
  }
  throw new Error('expected the manifest to be rejected')
}

describe('parseProduct errors', () => {
  it('reports three separate problems in one error with all three paths', () => {
    const error = manifestErrorThrown({
      ...sampleOneManifest,
      finishes: [{ ...graphiteFinish, swatch: 'green' }],
      hotspots: [{ ...driverHotspot, bullets: ['one', 'two', 'three', 'four'] }],
      camera: { minDistance: 2, maxDistance: 1 },
    })
    expect(error.label).toEqual('sample-one')
    expect(error.issues.map((issue) => issue.path)).toEqual([
      'finishes[0].swatch',
      'hotspots[0].bullets',
      'camera.maxDistance',
    ])
    for (const path of error.issues.map((issue) => issue.path)) {
      expect(error.message).toContain(path)
    }
    expect(error.message).toContain("'sample-one'")
  })

  it('carries the issues as structured data', () => {
    const error = manifestErrorThrown({
      ...sampleOneManifest,
      finishes: [{ ...graphiteFinish, swatch: 'green' }],
    })
    expect(error.issues).toEqual([
      { path: 'finishes[0].swatch', message: 'expected a hex color in #RRGGBB form' },
    ])
  })

  it('names the manifest by source when the slug itself is invalid', () => {
    const error = manifestErrorThrown({
      ...sampleOneManifest,
      slug: 'Sample One',
      finishes: [{ ...graphiteFinish, swatch: 'green' }],
    })
    expect(error.label).toEqual(SOURCE)
    expect(error.message).toContain(`'${SOURCE}'`)
    expect(error.message).not.toContain('Sample One')
  })

  it('reports one entry per unknown key, with the key on the path', () => {
    const error = manifestErrorThrown({ ...sampleOneManifest, nope: 1, nada: 2 })
    expect(error.issues).toContainEqual({ path: 'nope', message: 'unknown key' })
    expect(error.issues).toContainEqual({ path: 'nada', message: 'unknown key' })
  })

  it('reports an unknown key on a nested object with its full path', () => {
    const error = manifestErrorThrown({
      ...sampleOneManifest,
      hotspots: [{ ...driverHotspot, nope: 1 }],
    })
    expect(error.issues).toContainEqual({ path: 'hotspots[0].nope', message: 'unknown key' })
  })
})

describe('formatFieldPath', () => {
  it('joins object keys with dots', () => {
    expect(formatFieldPath(['camera', 'minDistance'])).toEqual('camera.minDistance')
  })

  it('wraps array positions in brackets', () => {
    expect(formatFieldPath(['hotspots', 1, 'bullets', 0])).toEqual('hotspots[1].bullets[0]')
  })

  it('renders an empty path as an empty string', () => {
    expect(formatFieldPath([])).toEqual('')
  })
})
