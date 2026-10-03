import { describe, expect, it } from 'vitest'
import type { StageRect } from '@lib/hotspots/cardPlacement'
import type { CardDockPolicy } from '@lib/hotspots/cardPresentation'
import { StageOverlay, type OverlayElement } from '@viewer/overlay/StageOverlay'
import type { CardLayout } from './cardLayout'
import { HotspotCardPresenter } from './HotspotCardPresenter'
import { CARD_OVERLAY_KEY, overlayKey } from './hotspotKeys'

// The presenter over a real overlay channel and page-read stand-ins: two
// markers, a floating card element the overlay writes, passes written the
// way the canvas side writes them, and a count of the page reads.

const metrics = { markerHitPx: 44, cardOffsetPx: 8, focusOutsetPx: 5 }
const card = { width: 200, height: 100 }

function setup(
  policy: { current: CardDockPolicy } = { current: 'when-crowded' },
  chrome: { current: readonly StageRect[] } = { current: [] },
) {
  const overlay = new StageOverlay()
  const reads = { count: 0 }
  const layout = (): CardLayout => {
    reads.count += 1
    return { policy: policy.current, metrics }
  }
  const presenter = new HotspotCardPresenter(overlay, ['driver', 'knob'], {
    layout,
    obstacles: () => chrome.current,
  })
  const element: OverlayElement = { style: { visibility: '', transform: '' } }
  overlay.mount(CARD_OVERLAY_KEY, element, 'top-left')
  let publishes = 0
  presenter.subscribe(() => {
    publishes += 1
  })
  return { overlay, presenter, element, publishes: () => publishes, reads: () => reads.count }
}

function pass(
  overlay: StageOverlay,
  stage: { width: number; height: number },
  markers: Readonly<Record<string, { x: number; y: number } | null>>,
) {
  overlay.pass(stage, (place) => {
    for (const [id, point] of Object.entries(markers)) {
      place(overlayKey(id), point === null ? { kind: 'hidden' } : { kind: 'placed', ...point })
    }
  })
}

describe('HotspotCardPresenter', () => {
  it('floats a new card hidden until its first measure, then places it beside its marker', () => {
    const { overlay, presenter, element } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })

    presenter.show('driver')
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
    presenter.show('driver')
    presenter.measure(card)
    overlay.onPass(() => presenter.present())

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

    presenter.show('driver')

    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked', shown: true })
    expect(element.style.visibility).toBe('hidden')
  })

  it('docks a card with no room and floats it again from its measured size once there is room', () => {
    const { overlay, presenter } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show('driver')
    presenter.measure(card)

    pass(overlay, { width: 250, height: 200 }, { driver: { x: 125, y: 100 }, knob: null })
    presenter.present()
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked', shown: true })

    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.present()
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'floating' })
  })

  it('hides a floating card while its marker is hidden', () => {
    const { overlay, presenter, element } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show('driver')
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
    presenter.show('driver')
    presenter.measure(card)

    presenter.show('knob')

    expect(presenter.snapshot()).toEqual({ hotspotId: 'knob', where: 'floating' })
    expect(element.style.visibility).toBe('hidden')
  })

  it('publishes only when the slot changes, and clears it with the selection', () => {
    const { overlay, presenter, publishes } = setup()
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show('driver')
    presenter.measure(card)
    presenter.present()
    presenter.present()

    expect(publishes()).toBe(1)

    presenter.show(null)
    expect(presenter.snapshot()).toBeNull()
    expect(publishes()).toBe(2)
  })

  it('hides a docked card in the dock while its marker hides, never changing its slot, for both reasons it docked', () => {
    const roomy = { width: 800, height: 600 }
    const cramped = { width: 250, height: 200 }
    const cases = [
      { policy: 'always' as const, stage: roomy, at: { x: 400, y: 300 } },
      { policy: 'when-crowded' as const, stage: cramped, at: { x: 125, y: 100 } },
    ]
    for (const { policy, stage, at } of cases) {
      const { overlay, presenter } = setup({ current: policy })
      pass(overlay, stage, { driver: at, knob: null })
      presenter.show('driver')
      presenter.measure(card)
      const slots = [presenter.snapshot()]

      pass(overlay, stage, { driver: null, knob: null })
      presenter.present()
      slots.push(presenter.snapshot())
      pass(overlay, stage, { driver: at, knob: null })
      presenter.present()
      slots.push(presenter.snapshot())

      expect(slots, policy).toEqual([
        { hotspotId: 'driver', where: 'docked', shown: true },
        { hotspotId: 'driver', where: 'docked', shown: false },
        { hotspotId: 'driver', where: 'docked', shown: true },
      ])
    }
  })

  it('keeps the card clear of the chrome, and reads the chrome again when it changes', () => {
    const chrome: { current: readonly StageRect[] } = { current: [] }
    const { overlay, presenter, element } = setup({ current: 'when-crowded' }, chrome)
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show('driver')
    presenter.measure(card)
    expect(element.style.transform).toBe('translate(430px, 250px)')

    chrome.current = [{ left: 600, top: 320, right: 700, bottom: 360 }]
    presenter.chromeChanged()

    expect(element.style.transform).toBe('translate(170px, 250px)')
  })

  it('reads the page on a selection, a measure and a stage resize, and not on a pass of the same stage box', () => {
    const { overlay, presenter, reads } = setup()
    overlay.onPass(() => presenter.present())
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show('driver')
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
    overlay.onPass(() => presenter.present())
    pass(overlay, { width: 800, height: 600 }, { driver: { x: 400, y: 300 }, knob: null })
    presenter.show('driver')
    presenter.measure(card)
    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'floating' })

    policy.current = 'always'
    pass(overlay, { width: 390, height: 523 }, { driver: { x: 195, y: 215 }, knob: null })

    expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked', shown: true })
  })
})
