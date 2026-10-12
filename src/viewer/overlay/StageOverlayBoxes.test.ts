import { describe, expect, it } from 'vitest'
import { StageOverlay } from './StageOverlay'

describe('the box channel', () => {
  it('publishes a box under its key and answers it between passes', () => {
    const overlay = new StageOverlay()

    overlay.placeBox('a', { left: 1, top: 2, right: 3, bottom: 4 })

    expect(overlay.boxOf('a')).toEqual({ left: 1, top: 2, right: 3, bottom: 4 })
    expect(overlay.boxOf('b'), 'a key with no box answers null').toBeNull()
  })

  it('writes the boxes of a pass before the presenters run', () => {
    const overlay = new StageOverlay()
    let seen: unknown = null
    overlay.onPass(() => {
      seen = overlay.boxOf('a')
    }, 'presenter')

    overlay.pass({ width: 10, height: 10 }, (place, placeBox) => {
      place('a', { kind: 'hidden' })
      placeBox('a', { left: 0, top: 0, right: 5, bottom: 5 })
    })

    expect(seen).toEqual({ left: 0, top: 0, right: 5, bottom: 5 })
  })

  it('keeps the last box standing when a pass writes none', () => {
    const overlay = new StageOverlay()
    overlay.pass({ width: 10, height: 10 }, (_place, placeBox) => {
      placeBox('a', { left: 1, top: 1, right: 2, bottom: 2 })
    })

    overlay.pass({ width: 10, height: 10 }, () => {})

    expect(overlay.boxOf('a')).toEqual({ left: 1, top: 1, right: 2, bottom: 2 })
  })

  it('takes the boxes off with the rest of the product records when the content leaves', () => {
    const overlay = new StageOverlay()
    overlay.pass({ width: 10, height: 10 }, (place, placeBox) => {
      place('a', { kind: 'placed', x: 1, y: 2 })
      placeBox('a', { left: 1, top: 1, right: 2, bottom: 2 })
    })

    overlay.clearProductState()

    expect(overlay.boxOf('a'), 'the next content reads no box of the last').toBeNull()
    expect(overlay.placementOf('a')).toBeNull()
    overlay.placeBox('a', { left: 5, top: 5, right: 6, bottom: 6 })
    expect(overlay.boxOf('a'), 'the next content publishes its own').toEqual({
      left: 5,
      top: 5,
      right: 6,
      bottom: 6,
    })
  })
})
