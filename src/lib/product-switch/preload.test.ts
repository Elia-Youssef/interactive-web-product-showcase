import { describe, expect, it } from 'vitest'
import { createCollection } from '../product/collection'
import { sampleOneManifest, sampleThreeManifest, sampleTwoManifest } from '../product/fixtures'
import { applyProductSwitchEvent, initialProductSwitch } from './machine'
import { preloadSlugs } from './preload'

const three = createCollection([sampleOneManifest, sampleTwoManifest, sampleThreeManifest])

function restedOn(slug: string) {
  return applyProductSwitchEvent(initialProductSwitch(slug), {
    kind: 'settled',
    life: 0,
    outcome: 'ready',
  })
}

describe('preloadSlugs', () => {
  it('fetches nothing ahead before a first rest', () => {
    expect(preloadSlugs(initialProductSwitch('sample-one').rested, three)).toEqual([])
  })

  it('names the previous and the next neighbor of the rested product, wrapping at the ends', () => {
    expect(preloadSlugs(restedOn('sample-one').rested, three)).toEqual([
      'sample-three',
      'sample-two',
    ])
    expect(preloadSlugs(restedOn('sample-two').rested, three)).toEqual([
      'sample-one',
      'sample-three',
    ])
  })

  it('names a two-product collection neighbor once', () => {
    const two = createCollection([sampleOneManifest, sampleTwoManifest])
    expect(preloadSlugs(restedOn('sample-one').rested, two)).toEqual(['sample-two'])
  })

  it('never names the rested product itself', () => {
    const one = createCollection([sampleOneManifest])
    expect(preloadSlugs(restedOn('sample-one').rested, one)).toEqual([])
  })

  it('keeps the rested neighbors through a running switch', () => {
    const switching = applyProductSwitchEvent(restedOn('sample-one'), {
      kind: 'navigated',
      slug: 'sample-two',
    })
    expect(preloadSlugs(switching.rested, three)).toEqual(['sample-three', 'sample-two'])
  })

  it('fails loudly for a rested product the collection does not hold', () => {
    expect(() => preloadSlugs(restedOn('nope').rested, three)).toThrow("no product 'nope'")
  })
})
