import { describe, expect, it } from 'vitest'
import {
  applyCameraOutcomeEvent,
  applyCameraReadoutEvent,
  hasUnhandledCameraRequest,
  initialCameraOutcome,
  initialCameraReadout,
  initialCameraRequestChannel,
  nextCameraRequest,
  type CameraReadout,
  type CameraReadoutEvent,
} from './camera.logic'

const live = (
  overrides: Partial<Extract<CameraReadout, { kind: 'live' }>> = {},
): CameraReadout => ({
  kind: 'live',
  azimuth: 0.5,
  distance: 2,
  endDistance: 2,
  minDistance: 1,
  maxDistance: 4,
  ...overrides,
})

describe('applyCameraReadoutEvent', () => {
  const table: readonly {
    name: string
    from: CameraReadout
    event: CameraReadoutEvent
    expected: CameraReadout
    identical?: boolean
  }[] = [
    {
      name: 'idle + live becomes live',
      from: initialCameraReadout,
      event: {
        kind: 'live',
        azimuth: 0.5,
        distance: 2,
        endDistance: 2,
        minDistance: 1,
        maxDistance: 4,
      },
      expected: live(),
    },
    {
      name: 'live + live with new values becomes live with those values',
      from: live(),
      event: {
        kind: 'live',
        azimuth: 1.5,
        distance: 3,
        endDistance: 3,
        minDistance: 1,
        maxDistance: 4,
      },
      expected: live({ azimuth: 1.5, distance: 3, endDistance: 3 }),
    },
    {
      name: 'live + idle becomes idle',
      from: live(),
      event: { kind: 'idle' },
      expected: initialCameraReadout,
    },
    {
      name: 'idle + idle stays idle',
      from: initialCameraReadout,
      event: { kind: 'idle' },
      expected: initialCameraReadout,
      identical: true,
    },
    {
      name: 'live + live with the same values keeps the store identity',
      from: live(),
      event: {
        kind: 'live',
        azimuth: 0.5,
        distance: 2,
        endDistance: 2,
        minDistance: 1,
        maxDistance: 4,
      },
      expected: live(),
      identical: true,
    },
  ]

  for (const row of table) {
    it(row.name, () => {
      const next = applyCameraReadoutEvent(row.from, row.event)
      expect(next).toEqual(row.expected)
      if (row.identical === true) {
        expect(next).toBe(row.from)
      }
    })
  }
})

describe('nextCameraRequest', () => {
  it('sequences each request above the one before it', () => {
    const first = nextCameraRequest(initialCameraRequestChannel, { kind: 'view', viewId: 'home' })
    const second = nextCameraRequest(first, { kind: 'zoom', direction: 1 })
    const third = nextCameraRequest(second, { kind: 'zoom', direction: 1 })

    expect(first).toEqual({ sequence: 1, request: { kind: 'view', viewId: 'home' } })
    expect(second.sequence).toBe(2)
    expect(third.sequence).toBe(3)
    expect(third.request).toEqual({ kind: 'zoom', direction: 1 })
  })

  it('gives a repeated request its own sequence, so it runs twice', () => {
    const first = nextCameraRequest(initialCameraRequestChannel, { kind: 'zoom', direction: -1 })
    const second = nextCameraRequest(first, { kind: 'zoom', direction: -1 })

    expect(first.request).toEqual(second.request)
    expect(second.sequence).toBe(first.sequence + 1)
  })
})

describe('hasUnhandledCameraRequest', () => {
  const channel = nextCameraRequest(initialCameraRequestChannel, { kind: 'view', viewId: 'home' })

  it('reports a request above the executed sequence', () => {
    expect(hasUnhandledCameraRequest(channel, 0)).toBe(true)
  })

  it('reports nothing once that sequence is executed', () => {
    expect(hasUnhandledCameraRequest(channel, 1)).toBe(false)
    expect(hasUnhandledCameraRequest(channel, 2)).toBe(false)
  })

  it('reports nothing on an empty channel', () => {
    expect(hasUnhandledCameraRequest(initialCameraRequestChannel, 0)).toBe(false)
  })
})

describe('applyCameraOutcomeEvent', () => {
  const home = { kind: 'view', viewId: 'home' } as const
  const zoomIn = { kind: 'zoom', direction: 1 } as const

  it('records an arrived request with its sequence and its request', () => {
    const next = applyCameraOutcomeEvent(initialCameraOutcome, {
      kind: 'arrived',
      sequence: 3,
      request: home,
    })
    expect(next).toEqual({ sequence: 3, request: home, outcome: { kind: 'arrived' } })
  })

  it.each(['no-plan', 'unknown-view'] as const)(
    'records a %s rejection with its reason',
    (reason) => {
      const next = applyCameraOutcomeEvent(initialCameraOutcome, {
        kind: 'rejected',
        sequence: 1,
        request: zoomIn,
        reason,
      })
      expect(next).toEqual({ sequence: 1, request: zoomIn, outcome: { kind: 'rejected', reason } })
    },
  )

  it('moves on to a newer sequence', () => {
    const first = applyCameraOutcomeEvent(initialCameraOutcome, {
      kind: 'arrived',
      sequence: 1,
      request: home,
    })
    const next = applyCameraOutcomeEvent(first, { kind: 'arrived', sequence: 2, request: zoomIn })
    expect(next).toEqual({ sequence: 2, request: zoomIn, outcome: { kind: 'arrived' } })
  })

  it('keeps the newer outcome when an older sequence reports after it', () => {
    const newer = applyCameraOutcomeEvent(initialCameraOutcome, {
      kind: 'arrived',
      sequence: 5,
      request: zoomIn,
    })
    const next = applyCameraOutcomeEvent(newer, { kind: 'arrived', sequence: 4, request: home })
    expect(next).toBe(newer)
  })

  it('replaces the outcome of the recorded sequence written again', () => {
    const arrived = applyCameraOutcomeEvent(initialCameraOutcome, {
      kind: 'arrived',
      sequence: 1,
      request: home,
    })
    const next = applyCameraOutcomeEvent(arrived, {
      kind: 'rejected',
      sequence: 1,
      request: home,
      reason: 'no-plan',
    })
    expect(next?.outcome).toEqual({ kind: 'rejected', reason: 'no-plan' })
  })

  // The bound is the design: a held key asks once per frame for as long as
  // it is held, and the record stays one entry however many settle.
  it('stays one entry over any number of requests', () => {
    let record = initialCameraOutcome
    for (let sequence = 1; sequence <= 10_000; sequence += 1) {
      record = applyCameraOutcomeEvent(record, { kind: 'arrived', sequence, request: zoomIn })
    }
    expect(record).toEqual({ sequence: 10_000, request: zoomIn, outcome: { kind: 'arrived' } })
    expect(Object.keys(record ?? {})).toEqual(['sequence', 'request', 'outcome'])
  })
})
