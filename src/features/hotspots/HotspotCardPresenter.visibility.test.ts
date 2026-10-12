import { describe, expect, it } from 'vitest'
import { markerLossCases } from '@lib/hotspots/markerLoss.fixtures'
import { setup, pass, card } from './HotspotCardPresenter.fixtures'

describe('the docked card visibility intent', () => {
  for (const policy of ['always', 'when-crowded'] as const) {
    it.each(markerLossCases)(`keeps the ${policy} dock readable after $reason`, ({ marker }) => {
      const { overlay, presenter } = setup({ current: policy })
      const stage = { width: 250, height: 200 }
      pass(overlay, stage, { driver: { x: 125, y: 100 }, knob: null })
      presenter.show({ hotspotId: 'driver', origin: 'marker' })
      presenter.measure(card)
      const release = overlay.card.mount('driver', 'docked', () => ({
        mounted: true,
        shown: true,
        bounds: { left: 0, top: 0, right: 200, bottom: 100 },
      }))
      pass(overlay, stage, { driver: marker, knob: null })
      presenter.present()
      overlay.card.present()
      expect(presenter.snapshot()).toEqual({ hotspotId: 'driver', where: 'docked' })
      expect(
        overlay.card.idle,
        'the presenter acknowledges a readable native dock after marker loss',
      ).toBe(true)
      release()
      presenter.show(null)
      overlay.card.present()
      expect(presenter.snapshot()).toBeNull()
      expect(overlay.card.idle, 'clearing selection acknowledges the removed host').toBe(true)
    })
  }
})
