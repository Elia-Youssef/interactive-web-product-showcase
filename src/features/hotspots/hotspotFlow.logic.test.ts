import { describe, expect, it } from 'vitest'
import { hotspotCameraRequest } from './hotspotFlow.logic'

// The flow table: every transition of the selection, with and without a
// close-up on each side. 'driver' and 'knob' stand for any hotspot pair.
describe('hotspotCameraRequest', () => {
  const both = new Set(['driver', 'knob'])
  const driverOnly = new Set(['driver'])

  const table: readonly {
    readonly name: string
    readonly before: string | null
    readonly after: string | null
    readonly closeUps: ReadonlySet<string>
    readonly owed: { readonly kind: 'view'; readonly viewId: string } | null
  }[] = [
    {
      name: 'idle to a hotspot with a close-up owes that close-up',
      before: null,
      after: 'driver',
      closeUps: driverOnly,
      owed: { kind: 'view', viewId: 'driver' },
    },
    {
      name: 'idle to a hotspot without a close-up owes no move',
      before: null,
      after: 'knob',
      closeUps: driverOnly,
      owed: null,
    },
    {
      name: 'a hotspot with a close-up to idle owes home',
      before: 'driver',
      after: null,
      closeUps: driverOnly,
      owed: { kind: 'view', viewId: 'home' },
    },
    {
      name: 'a hotspot without a close-up to idle owes no move',
      before: 'knob',
      after: null,
      closeUps: driverOnly,
      owed: null,
    },
    {
      name: 'a switch to a hotspot with a close-up owes the new close-up',
      before: 'driver',
      after: 'knob',
      closeUps: both,
      owed: { kind: 'view', viewId: 'knob' },
    },
    {
      name: 'a switch to a hotspot without a close-up owes home when the closed one had a close-up',
      before: 'driver',
      after: 'knob',
      closeUps: driverOnly,
      owed: { kind: 'view', viewId: 'home' },
    },
    {
      name: 'a switch to a hotspot with a close-up owes the new one even from one without',
      before: 'knob',
      after: 'driver',
      closeUps: driverOnly,
      owed: { kind: 'view', viewId: 'driver' },
    },
    {
      name: 'a switch between two hotspots without close-ups owes no move',
      before: 'knob',
      after: 'driver',
      closeUps: new Set(),
      owed: null,
    },
    {
      name: 'idle to idle owes no move',
      before: null,
      after: null,
      closeUps: both,
      owed: null,
    },
  ]

  for (const row of table) {
    it(row.name, () => {
      expect(hotspotCameraRequest(row.before, row.after, row.closeUps)).toEqual(row.owed)
    })
  }
})
