import { describe, expect, it } from 'vitest'
import { StageProbes } from './StageProbes'
import type { ViewerLook } from './viewerAutomation'

function lookOf(exposure: number): ViewerLook {
  return {
    exposure,
    environmentIntensity: 1,
    environmentRotationDeg: 0,
    shadow: null,
    textures: null,
  }
}

describe('StageProbes', () => {
  it('reads null while no component holds the key', () => {
    expect(new StageProbes().read('look')).toBeNull()
  })

  it('reads the held reader live at access time', () => {
    const probes = new StageProbes()
    let value = lookOf(1)
    const release = probes.register('look', () => value)

    expect(probes.read('look')).toEqual(lookOf(1))

    // The probe holds the reader, never a copy: the value changes are what
    // the next read reports.
    value = lookOf(2.5)
    expect(probes.read('look')).toEqual(lookOf(2.5))
    release()
  })

  it('reads null again once the registration releases', () => {
    const probes = new StageProbes()
    probes.register('look', () => lookOf(1))()
    expect(probes.read('look')).toBeNull()
  })

  it('refuses a second registration while the key is held, naming the key', () => {
    const probes = new StageProbes()
    probes.register('look', () => lookOf(1))
    expect(() => probes.register('look', () => lookOf(2))).toThrow("probe 'look' is already held")
    // The first reader stays the one the key answers to.
    expect(probes.read('look')).toEqual(lookOf(1))
  })

  it('registers the key again after a release, as an effect re-run does', () => {
    const probes = new StageProbes()
    probes.register('look', () => lookOf(1))()
    probes.register('look', () => lookOf(3))
    expect(probes.read('look')).toEqual(lookOf(3))
  })

  it('fails a stale release loudly and leaves the later holder standing', () => {
    const probes = new StageProbes()
    const stale = probes.register('look', () => lookOf(1))
    stale()
    probes.register('look', () => lookOf(2))

    // The stale release is not the current holder's, so it must throw
    // instead of dropping the reader a later registration installed.
    expect(() => stale()).toThrow('stale')
    expect(probes.read('look')).toEqual(lookOf(2))
  })
})
