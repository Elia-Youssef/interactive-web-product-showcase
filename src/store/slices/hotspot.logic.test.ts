import { describe, expect, it } from 'vitest'
import type { HotspotStatus } from './hotspot.logic'
import { applyHotspotEvent, initialHotspotStatus } from './hotspot.logic'

const selected: HotspotStatus = { kind: 'selected', product: 'forma-one', hotspot: 'driver' }

describe('applyHotspotEvent', () => {
  it('selects a hotspot from idle', () => {
    expect(
      applyHotspotEvent(initialHotspotStatus, {
        kind: 'toggled',
        product: 'forma-one',
        hotspot: 'driver',
      }),
    ).toEqual(selected)
  })

  it('pressing the active hotspot clears the selection', () => {
    expect(
      applyHotspotEvent(selected, { kind: 'toggled', product: 'forma-one', hotspot: 'driver' }),
    ).toEqual(initialHotspotStatus)
  })

  it('pressing another hotspot of the same product moves the one selection', () => {
    expect(
      applyHotspotEvent(selected, { kind: 'toggled', product: 'forma-one', hotspot: 'knob' }),
    ).toEqual({
      kind: 'selected',
      product: 'forma-one',
      hotspot: 'knob',
    })
  })

  it('replaces a stale selection of another product, which the selector then cannot read', () => {
    expect(
      applyHotspotEvent(selected, { kind: 'toggled', product: 'forma-two', hotspot: 'driver' }),
    ).toEqual({
      kind: 'selected',
      product: 'forma-two',
      hotspot: 'driver',
    })
  })

  it('clears the selection of its own product', () => {
    expect(applyHotspotEvent(selected, { kind: 'cleared', product: 'forma-one' })).toEqual(
      initialHotspotStatus,
    )
  })

  it('ignores a clear from a product the status does not belong to', () => {
    expect(applyHotspotEvent(selected, { kind: 'cleared', product: 'forma-two' })).toEqual(selected)
    expect(
      applyHotspotEvent(initialHotspotStatus, { kind: 'cleared', product: 'forma-one' }),
    ).toEqual(initialHotspotStatus)
  })
})
