import { describe, expect, it } from 'vitest'
import { CARD_OVERLAY_KEY, overlayKey } from '@features/hotspots'
import { StageOverlay } from '@viewer/overlay/StageOverlay'
import { observeCardVisibility, type HarnessCardVisibilitySample } from './cardVisibilityObserver'

// The card probe's order against the card presenter: whichever subscribed
// first, the probe's sample of a pass holds the card placement the
// presenter wrote in that same pass, never the previous one.
describe('observeCardVisibility', () => {
  const marker = overlayKey('driver')

  it.each(['floating', 'docked', 'listed'] as const)(
    'reads actual committed %s geometry independent of placement',
    (slot) => {
      const overlay = new StageOverlay()
      let shown = true
      overlay.card.mount('driver', slot, () => ({
        mounted: true,
        shown,
        bounds: { left: 10, top: 20, right: 50, bottom: 80 },
      }))
      const samples: HarnessCardVisibilitySample[] = []
      observeCardVisibility(
        overlay,
        () => ({ selected: 'driver', t: 0.5 }),
        (sample) => samples.push(sample),
      )
      overlay.pass({ width: 100, height: 100 }, (place) =>
        place(marker, { kind: 'placed', x: 30, y: 40 }),
      )
      expect(samples[0]?.cardVisible).toBe(true)
      shown = false
      overlay.place(CARD_OVERLAY_KEY, { kind: 'placed', x: 10, y: 20 })
      overlay.pass({ width: 100, height: 100 }, (place) => place(marker, { kind: 'hidden' }))
      expect(samples[1]?.cardVisible).toBe(false)
    },
  )

  // A presenter that places the card exactly where the pass placed its
  // marker, and hides it when the marker hides, as the card's own rule does.
  function cardPresenter(overlay: StageOverlay) {
    overlay.card.mount('driver', 'floating', () => ({
      mounted: true,
      shown: overlay.placementOf(CARD_OVERLAY_KEY)?.kind === 'placed',
      bounds: { left: 0, top: 0, right: 10, bottom: 10 },
    }))
    return overlay.onPass(() => {
      const placement = overlay.placementOf(marker)
      overlay.place(CARD_OVERLAY_KEY, placement ?? { kind: 'hidden' })
    }, 'presenter')
  }

  function samplesOver(probeFirst: boolean): readonly HarnessCardVisibilitySample[] {
    const overlay = new StageOverlay()
    const samples: HarnessCardVisibilitySample[] = []
    const observe = () =>
      observeCardVisibility(
        overlay,
        () => ({ selected: 'driver', t: 0.5 }),
        (sample) => samples.push(sample),
      )
    if (probeFirst) {
      observe()
      cardPresenter(overlay)
    } else {
      cardPresenter(overlay)
      observe()
    }
    overlay.pass({ width: 100, height: 100 }, (place) =>
      place(marker, { kind: 'placed', x: 10, y: 20 }),
    )
    overlay.pass({ width: 100, height: 100 }, (place) => place(marker, { kind: 'hidden' }))
    overlay.pass({ width: 100, height: 100 }, (place) =>
      place(marker, { kind: 'placed', x: 30, y: 40 }),
    )
    return samples
  }

  it.each([
    { name: 'the probe subscribed after the card presenter', probeFirst: false },
    { name: 'the probe subscribed before the card presenter', probeFirst: true },
  ])('reads the card the same pass placed, $name', ({ probeFirst }) => {
    expect(
      samplesOver(probeFirst).map(({ t, selected, markerVisible, cardVisible }) => ({
        t,
        selected,
        markerVisible,
        cardVisible,
      })),
    ).toEqual([
      { t: 0.5, selected: 'driver', markerVisible: true, cardVisible: true },
      { t: 0.5, selected: 'driver', markerVisible: false, cardVisible: false },
      { t: 0.5, selected: 'driver', markerVisible: true, cardVisible: true },
    ])
  })

  it('records nothing while no card is open', () => {
    const overlay = new StageOverlay()
    const samples: HarnessCardVisibilitySample[] = []
    observeCardVisibility(
      overlay,
      () => null,
      (sample) => samples.push(sample),
    )

    overlay.pass({ width: 100, height: 100 }, (place) =>
      place(marker, { kind: 'placed', x: 10, y: 20 }),
    )

    expect(samples).toEqual([])
  })
})
