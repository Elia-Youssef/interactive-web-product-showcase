import { describe, expect, it } from 'vitest'
import {
  applyCameraOutcomeEvent,
  applyCameraReadoutEvent,
  hasUnhandledCameraRequest,
  initialCameraOutcomes,
  initialCameraReadout,
  initialCameraRequestChannel,
  nextCameraRequest,
  type CameraOutcomeEvent,
  type CameraOutcomes,
  type CameraReadout,
  type CameraReadoutEvent,
  type CameraRequestOutcome,
} from './camera.logic'

const live = (
  overrides: Partial<Extract<CameraReadout, { kind: 'live' }>> = {},
): CameraReadout => ({
  kind: 'live',
  azimuth: 0.5,
  distance: 2,
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
      event: { kind: 'live', azimuth: 0.5, distance: 2, minDistance: 1, maxDistance: 4 },
      expected: live(),
    },
    {
      name: 'live + live with new values becomes live with those values',
      from: live(),
      event: { kind: 'live', azimuth: 1.5, distance: 3, minDistance: 1, maxDistance: 4 },
      expected: live({ azimuth: 1.5, distance: 3 }),
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
      event: { kind: 'live', azimuth: 0.5, distance: 2, minDistance: 1, maxDistance: 4 },
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
  // The outcomes the row's `from` state is seeded with, in order.
  const arrived = (sequences: readonly number[]): CameraOutcomes => {
    let outcomes = initialCameraOutcomes
    for (const sequence of sequences) {
      outcomes = applyCameraOutcomeEvent(outcomes, { kind: 'arrived', sequence })
    }
    return outcomes
  }

  const table: readonly {
    name: string
    seed: readonly number[]
    event: CameraOutcomeEvent
    expected: ReadonlyMap<number, CameraRequestOutcome>
  }[] = [
    {
      name: 'an arrived request is recorded by its sequence',
      seed: [],
      event: { kind: 'arrived', sequence: 3 },
      expected: new Map([[3, { kind: 'arrived' }]]),
    },
    {
      name: 'a no-plan rejection is recorded with its reason',
      seed: [],
      event: { kind: 'rejected', sequence: 1, reason: 'no-plan' },
      expected: new Map([[1, { kind: 'rejected', reason: 'no-plan' }]]),
    },
    {
      name: 'an unknown-view rejection is recorded with its reason',
      seed: [],
      event: { kind: 'rejected', sequence: 2, reason: 'unknown-view' },
      expected: new Map([[2, { kind: 'rejected', reason: 'unknown-view' }]]),
    },
    {
      name: 'two overlapping requests record one outcome each, both arrived at the final rest',
      seed: [1],
      event: { kind: 'arrived', sequence: 2 },
      expected: new Map([
        [1, { kind: 'arrived' }],
        [2, { kind: 'arrived' }],
      ]),
    },
  ]

  for (const row of table) {
    it(row.name, () => {
      const next = applyCameraOutcomeEvent(arrived(row.seed), row.event)

      expect(next).toEqual(row.expected)
    })
  }

  it('keeps the outcomes of earlier sequences', () => {
    const withFirst = applyCameraOutcomeEvent(initialCameraOutcomes, {
      kind: 'arrived',
      sequence: 1,
    })
    const next = applyCameraOutcomeEvent(withFirst, { kind: 'arrived', sequence: 2 })

    expect(next.get(1)).toEqual({ kind: 'arrived' })
    expect(next.get(2)).toEqual({ kind: 'arrived' })
  })

  it('keeps the input outcomes untouched', () => {
    const from = applyCameraOutcomeEvent(initialCameraOutcomes, { kind: 'arrived', sequence: 1 })
    applyCameraOutcomeEvent(from, { kind: 'rejected', sequence: 2, reason: 'no-plan' })

    expect(from.size).toBe(1)
    expect(from.get(2)).toBeUndefined()
  })

  it('replaces the outcome of a sequence written again', () => {
    const withArrived = applyCameraOutcomeEvent(initialCameraOutcomes, {
      kind: 'arrived',
      sequence: 1,
    })
    const next = applyCameraOutcomeEvent(withArrived, {
      kind: 'rejected',
      sequence: 1,
      reason: 'no-plan',
    })

    expect(next.get(1)).toEqual({ kind: 'rejected', reason: 'no-plan' })
  })
})
