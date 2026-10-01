import { describe, expect, it } from 'vitest'
import { resolveProductLook, type ProductLookValues } from './resolveLook'

const defaults: ProductLookValues = {
  exposure: 1,
  environmentIntensity: 2,
  environmentRotationDeg: 30,
  shadowOpacity: 0.8,
}

describe('resolveProductLook', () => {
  it('an absent block gives every default', () => {
    expect(resolveProductLook(undefined, defaults)).toEqual(defaults)
  })

  it('an empty block gives every default', () => {
    expect(resolveProductLook({}, defaults)).toEqual(defaults)
  })

  it('an authored field wins over its default', () => {
    expect(resolveProductLook({ exposure: 2.5 }, defaults)).toEqual({ ...defaults, exposure: 2.5 })
    expect(resolveProductLook({ environmentIntensity: 0 }, defaults)).toEqual({
      ...defaults,
      environmentIntensity: 0,
    })
    expect(resolveProductLook({ environmentRotationDeg: 180 }, defaults)).toEqual({
      ...defaults,
      environmentRotationDeg: 180,
    })
    expect(resolveProductLook({ shadowOpacity: 0 }, defaults)).toEqual({
      ...defaults,
      shadowOpacity: 0,
    })
  })

  it('a partial block mixes authored fields with defaults', () => {
    expect(resolveProductLook({ exposure: 4, shadowOpacity: 0.25 }, defaults)).toEqual({
      exposure: 4,
      environmentIntensity: 2,
      environmentRotationDeg: 30,
      shadowOpacity: 0.25,
    })
  })

  it('a zero default is a fallback, not a missing one', () => {
    const zeroDefaults: ProductLookValues = {
      exposure: 1,
      environmentIntensity: 0,
      environmentRotationDeg: 0,
      shadowOpacity: 0,
    }
    expect(resolveProductLook({}, zeroDefaults)).toEqual(zeroDefaults)
  })
})
