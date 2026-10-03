import { describe, expect, it } from 'vitest'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import { harnessOverrides, withOverrides } from './harnessOverrides'

function query(params: Record<string, string>): string {
  return `?${new URLSearchParams({ slug: 'sample-one', ...params }).toString()}`
}

function invalidReason(search: string): string {
  const parse = harnessOverrides(search)
  if (parse.kind !== 'invalid') {
    throw new Error(`the query ${search} must be invalid`)
  }
  return parse.reason
}

describe('harnessOverrides', () => {
  it('overrides nothing without a parameter or with an empty one', () => {
    expect(harnessOverrides('?slug=sample-one')).toEqual({ kind: 'valid', overrides: {} })
    expect(harnessOverrides('')).toEqual({ kind: 'valid', overrides: {} })
    expect(harnessOverrides('?look=&camera=')).toEqual({ kind: 'valid', overrides: {} })
  })

  it('parses a valid look block through the manifest schema', () => {
    expect(harnessOverrides(query({ look: '{"exposure":2}' }))).toEqual({
      kind: 'valid',
      overrides: { look: { exposure: 2 } },
    })
    expect(
      harnessOverrides(query({ look: '{"environmentRotationDeg":180,"shadowOpacity":0}' })),
    ).toEqual({
      kind: 'valid',
      overrides: { look: { environmentRotationDeg: 180, shadowOpacity: 0 } },
    })
  })

  it('parses a valid camera block through the manifest schema', () => {
    expect(harnessOverrides(query({ camera: '{"minDistance":1000}' }))).toEqual({
      kind: 'valid',
      overrides: { camera: { minDistance: 1000 } },
    })
  })

  it('carries both blocks when both parameters are given', () => {
    expect(
      harnessOverrides(query({ look: '{"exposure":2}', camera: '{"maxDistance":3}' })),
    ).toEqual({
      kind: 'valid',
      overrides: { look: { exposure: 2 }, camera: { maxDistance: 3 } },
    })
  })

  it('names a parameter that is not JSON', () => {
    expect(invalidReason(query({ look: 'bright' }))).toContain('the look parameter is not JSON')
    expect(invalidReason(query({ camera: 'far' }))).toContain('the camera parameter is not JSON')
  })

  it('names the field a block breaks', () => {
    expect(invalidReason(query({ look: '{"exposure":9}' }))).toContain('exposure')
    expect(invalidReason(query({ camera: '{"minDistance":-1}' }))).toContain('minDistance')
    expect(invalidReason(query({ camera: '{"minDistance":2,"maxDistance":1}' }))).toContain(
      'maxDistance',
    )
  })

  it('names an unknown key', () => {
    expect(invalidReason(query({ look: '{"brightness":2}' }))).toContain('brightness')
    expect(invalidReason(query({ camera: '{"fov":30}' }))).toContain('fov')
  })

  it('rejects a parameter that is not an object, without a crash', () => {
    expect(harnessOverrides(query({ look: '4' })).kind).toBe('invalid')
    expect(harnessOverrides(query({ camera: '4' })).kind).toBe('invalid')
  })
})

describe('withOverrides', () => {
  const manifest = parseProduct(sampleOneManifest, 'sample-one.test')

  it('keeps an absent manifest absent', () => {
    expect(withOverrides(undefined, { camera: { minDistance: 1 } })).toBeUndefined()
  })

  it('replaces exactly the overridden blocks', () => {
    const overridden = withOverrides(manifest, { camera: { minDistance: 1000 } })

    expect(overridden).toEqual({ ...manifest, camera: { minDistance: 1000 } })
    expect(overridden?.look).toEqual(manifest.look)
  })
})
