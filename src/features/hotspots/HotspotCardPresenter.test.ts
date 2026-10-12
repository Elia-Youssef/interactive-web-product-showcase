import { describe, expect, it } from 'vitest'
import type { CardDockPolicy } from '@lib/hotspots/cardPresentation'
import type { StageRect } from '@lib/hotspots/markerBox'
import { setup, pass, card } from './HotspotCardPresenter.fixtures'
import { CARD_OVERLAY_KEY, overlayKey } from '@lib/hotspots/hotspotKeys'

// The presenter over a real overlay channel and page-read stand-ins: two
// markers, a floating card element the overlay writes, passes written the
// way the canvas side writes them, and a count of the page reads.

const fromMarker = (hotspotId: string) => ({ hotspotId, origin: 'marker' }) as const
const fromList = (hotspotId: string) => ({ hotspotId, origin: 'list' }) as const

describe('HotspotCardPresenter', () => {
  it('keeps completion pending through first measurement and later geometry until presentation', () => {
    const { overlay, presenter, element } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    overlay.card.mount('driver', 'floating', () => ({
      mounted: true,
      shown: element.style.visibility === 'visible',
      bounds: { left: 0, top: 0, right: 200, bottom: 100 },
    }))
    presenter.show(fromMarker('driver'))
    overlay.card.present()
    expect(overlay.card.idle, 'a mounted host still owes its first size').toBe(false)
    presenter.measure(card)
    expect(overlay.card.idle, 'measured geometry still owes a presentation').toBe(false)
    overlay.card.present()
    expect(overlay.card.idle).toBe(true)
    presenter.measure({ ...card, width: 210 })
    expect(overlay.card.idle, 'later layout must also be presented').toBe(false)
    overlay.card.present()
    expect(overlay.card.idle).toBe(true)
  })
  it('floats a new card hidden until its first measure, then places it beside its marker', () => {
    const { overlay, presenter, element } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })

    presenter.show(fromMarker('driver'))
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'floating' })
    expect(element.style.visibility).toBe('hidden')

    presenter.measure(card)
    // Right of the marker: left 430, top 250.
    expect(element.style.visibility).toBe('visible')
    expect(element.style.transform).toBe('translate(430px, 250px)')
  })

  it('moves the card when a pass moves the markers, with the whole pass written first', () => {
    const { overlay, presenter, element } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)
    overlay.onPass(() => presenter.present(), 'presenter')

    // The knob lands where the right-side card would cover it: the card
    // takes the left side in the same pass.
    pass(
      overlay,
      { width: 800, height: 600 },
      { driver: { x: 400, y: 300 }, knob: { x: 530, y: 300 } },
    )

    expect(element.style.transform).toBe('translate(170px, 250px)')
  })

  it('docks every card under the always policy, its floating element hidden', () => {
    const { overlay, presenter, element } = setup({ current: 'always' })
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })

    presenter.show(fromMarker('driver'))

    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked' })
    expect(element.style.visibility).toBe('hidden')
  })

  it('docks a card with no room and floats it again from its measured size once there is room', () => {
    const { overlay, presenter } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)

    pass(overlay, { width: 250, height: 200 }, { driver: { x: 125, y: 100 }, knob: null })
    presenter.present()
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked' })

    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.present()
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'floating' })
  })

  it('hides a floating card while its marker is hidden', () => {
    const { overlay, presenter, element } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)

    pass(overlay, { width: 800, height: 600 }, { driver: null, knob: null })
    presenter.present()

    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'floating' })
    expect(element.style.visibility).toBe('hidden')
  })

  it('forgets the size with the selection, so the next card is measured before it shows', () => {
    const { overlay, presenter, element } = setup()
    pass(
      overlay,
      { width: 800, height: 600 },
      { driver: { x: 400, y: 300 }, knob: { x: 100, y: 100 } },
    )
    presenter.show(fromMarker('driver'))
    presenter.measure(card)

    presenter.show(fromMarker('knob'))

    expect(presenter.snapshot()).toEqual({ hotspotId: 'knob', where: 'floating' })
    expect(element.style.visibility).toBe('hidden')
  })

  it('publishes only when the slot changes, and clears it with the selection', () => {
    const { overlay, presenter, publishes } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)
    presenter.present()
    presenter.present()

    expect(publishes()).toBe(1)

    presenter.show(null)
    expect(presenter.snapshot()).toBeNull()
    expect(publishes()).toBe(2)
  })

  it("holds the card key's placement record until the position changes", () => {
    const { overlay, presenter } = setup()
    overlay.onPass(() => presenter.present(), 'presenter')
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)
    const placed = overlay.placementOf(CARD_OVERLAY_KEY)
    expect(placed).toEqual({ kind: 'placed', x: 430, y: 250 })

    // The same pass again lands the same values, so the record the overlay
    // holds is neither replaced nor rewritten.
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    expect(overlay.placementOf(CARD_OVERLAY_KEY)).toBe(placed)

    // A pass that moves the marker publishes a fresh record at the new spot.
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 402, y: 300 }, knob: null })
    const moved = overlay.placementOf(CARD_OVERLAY_KEY)
    expect(moved).not.toBe(placed)
    expect(moved).toEqual({ kind: 'placed', x: 432, y: 250 })
  })

  it('keeps the card clear of the chrome, and reads the chrome again when it changes', () => {
    const chrome: { current: readonly StageRect[] } = { current: [] }
    const { overlay, presenter, element } = setup({ current: 'when-crowded' }, chrome)
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)
    expect(element.style.transform).toBe('translate(430px, 250px)')

    chrome.current = [{ left: 600, top: 320, right: 700, bottom: 360 }]
    presenter.chromeChanged()

    expect(element.style.transform).toBe('translate(170px, 250px)')
  })

  it('keeps the card clear of its subject, from the extent the pass publishes', () => {
    const { overlay, presenter, element } = setup()
    overlay.onPass(() => presenter.present(), 'presenter')
    overlay.pass({ width: 800, height: 600 }, (place, placeBox) => {
      place(overlayKey('driver'), { kind: 'placed', x: 400, y: 300 })
      place(overlayKey('knob'), { kind: 'hidden' })
      placeBox(overlayKey('driver'), { left: 500, top: 280, right: 780, bottom: 340 })
    })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)

    // The subject covers the right side, so the card takes the left.
    expect(element.style.transform).toBe('translate(170px, 250px)')

    // A pass that publishes the subject clear of the right side floats the
    // card back to it, and a pass with no subject published leaves the last
    // box standing.
    overlay.pass({ width: 800, height: 600 }, (place, placeBox) => {
      place(overlayKey('driver'), { kind: 'placed', x: 400, y: 300 })
      place(overlayKey('knob'), { kind: 'hidden' })
      placeBox(overlayKey('driver'), { left: 500, top: 400, right: 780, bottom: 460 })
    })
    expect(element.style.transform).toBe('translate(430px, 250px)')
  })

  it('reads the page on a selection, a measure and a stage resize, and not on a pass of the same stage box', () => {
    const { overlay, presenter, reads } = setup()
    overlay.onPass(() => presenter.present(), 'presenter')
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)
    const afterOpen = reads()

    for (let frame = 0; frame < 5; frame += 1) {
      pass(overlay, { width: 800, height: 600 }, { driver: { x: 400 + frame, y: 300 }, knob: null })
    }
    expect(reads()).toBe(afterOpen)

    pass(overlay, { width: 390, height: 523 }, { driver: { x: 195, y: 215 }, knob: null })
    expect(reads()).toBe(afterOpen + 1)
  })

  it('docks an open card once a resized stage crosses into a docking layout', () => {
    const policy: { current: CardDockPolicy } = { current: 'when-crowded' }
    const { overlay, presenter } = setup(policy)
    overlay.onPass(() => presenter.present(), 'presenter')
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show(fromMarker('driver'))
    presenter.measure(card)
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'floating' })

    policy.current = 'always'
    pass(overlay, { width: 390, height: 523 }, { driver: { x: 195, y: 215 }, knob: null })

    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked' })
  })

  it('lists a card opened from the list, shown whether its marker is placed or hidden', () => {
    const { overlay, presenter, element } = setup({ current: 'always' })
    pass(overlay, { width: 800, height: 600 }, { driver: null, knob: { x: 400, y: 300 } })

    presenter.show(fromList('driver'))
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'listed' })
    expect(element.style.visibility).toBe('hidden')

    // The same hotspot moved to its marker leaves the list for the stage.
    presenter.show(fromMarker('driver'))
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked' })
    presenter.show(fromList('driver'))
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'listed' })
  })
})
