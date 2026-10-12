import { describe, expect, it } from 'vitest'
import { createStageSurface, type StageSurfaceElement } from './stageSurface'

// The element stand-in records the writes the channel makes, so the tests
// read the real calls, not a copy of the channel's state.
function fakeElement(): StageSurfaceElement & {
  readonly writes: [string, string][]
  readonly removals: string[]
} {
  const writes: [string, string][] = []
  const removals: string[] = []
  return {
    writes,
    removals,
    style: {
      setProperty: (property, value) => {
        writes.push([property, value])
      },
      removeProperty: (property) => {
        removals.push(property)
        return ''
      },
    },
  }
}

describe('createStageSurface', () => {
  it('writes a claimed property on the registered element', () => {
    const element = fakeElement()
    const surface = createStageSurface()
    surface.attach(element)

    const emphasis = surface.claim('--backdrop-grid-emphasis')
    emphasis.set('0.25')
    emphasis.set('0.75')

    expect(element.writes).toEqual([
      ['--backdrop-grid-emphasis', '0.25'],
      ['--backdrop-grid-emphasis', '0.75'],
    ])
    expect(element.removals).toEqual([])
  })

  it('removes the property when the claim releases', () => {
    const element = fakeElement()
    const surface = createStageSurface()
    surface.attach(element)

    const emphasis = surface.claim('--backdrop-grid-emphasis')
    emphasis.set('1')
    emphasis.release()

    expect(element.removals).toEqual(['--backdrop-grid-emphasis'])
  })

  it('fails loudly on a released claim that sets or releases again', () => {
    const element = fakeElement()
    const surface = createStageSurface()
    surface.attach(element)

    const emphasis = surface.claim('--backdrop-grid-emphasis')
    emphasis.set('1')
    emphasis.release()

    expect(() => emphasis.set('0.5')).toThrow(/released/)
    expect(() => emphasis.release()).toThrow(/stale/)
    expect(element.writes).toEqual([['--backdrop-grid-emphasis', '1']])
    expect(element.removals).toEqual(['--backdrop-grid-emphasis'])
  })

  it('holds a property name for one claim at a time', () => {
    const element = fakeElement()
    const surface = createStageSurface()
    surface.attach(element)

    const emphasis = surface.claim('--backdrop-grid-emphasis')
    expect(() => surface.claim('--backdrop-grid-emphasis')).toThrow(/already claimed/)

    // A different name claims freely, and a released name is claimable again.
    const other = surface.claim('--other-input')
    other.release()
    emphasis.release()
    expect(surface.claim('--backdrop-grid-emphasis')).toBeDefined()
  })

  it('unbinds the element on the attach release and fails loudly on a stale one', () => {
    const element = fakeElement()
    const surface = createStageSurface()
    const detach = surface.attach(element)
    detach()

    expect(() => detach()).toThrow(/stale/)

    // The element is free again, and the next attach holds it.
    surface.attach(fakeElement())
    expect(() => surface.attach(fakeElement())).toThrow(/already holds/)
  })

  it('fails loudly on a second attach and a claim before the element', () => {
    const surface = createStageSurface()

    expect(() => surface.claim('--backdrop-grid-emphasis')).toThrow(/before the stage bound/)

    surface.attach(fakeElement())
    expect(() => surface.attach(fakeElement())).toThrow(/already holds/)
  })
})
