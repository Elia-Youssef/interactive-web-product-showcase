import { describe, expect, it } from 'vitest'
import { cardBoxAt, type CardMetrics, type CardSide } from './cardPlacement'
import type { StageRectTarget } from './projection'
import {
  parseCardDockPolicy,
  presentHotspotCard,
  type CardDockPolicy,
  type CardPresentation,
  type CardPresentationInput,
  type CardSlotKind,
  type FloatingCard,
} from './cardPresentation'

const metrics: CardMetrics = { markerHitPx: 44, cardOffsetPx: 8, focusOutsetPx: 5 }
const marker = { x: 400, y: 300 }
const card = { width: 200, height: 100 }
const roomy = { width: 800, height: 600 }
// A stage with no side that fits the card around its marker.
const cramped = { width: 250, height: 200 }
const crampedMarker = { x: 125, y: 100 }

// Each case gets its own floating record prefilled with NaN, so a field the
// rule left unwritten fails the case instead of carrying an earlier case's
// answer.
function freshFloating(): FloatingCard {
  return {
    slot: 'floating',
    at: {
      side: 'right',
      left: Number.NaN,
      top: Number.NaN,
      right: Number.NaN,
      bottom: Number.NaN,
    },
  }
}

function boxAt(side: CardSide, at: { x: number; y: number }): StageRectTarget {
  const box: StageRectTarget = { left: 0, top: 0, right: 0, bottom: 0 }
  cardBoxAt(side, at, card, metrics, box)
  return box
}

function input(
  policy: CardDockPolicy,
  markerPlaced: boolean,
  room: boolean,
  current: CardSlotKind | null,
): CardPresentationInput {
  const at = markerPlaced && room ? marker : crampedMarker
  return {
    origin: 'marker',
    policy,
    stage: room ? roomy : cramped,
    marker: markerPlaced ? at : null,
    placedMarkers: markerPlaced ? [at] : [],
    subject: null,
    obstacles: [],
    card,
    metrics,
    current,
  }
}

const besideRight = (floating: FloatingCard): CardPresentation => ({
  slot: 'floating',
  at: floating.at,
})

// The sentinel a row uses for the floating-beside answer, which only the
// caller's own record can express.
const BESIDE_RIGHT = 'beside right' as const

type Row = readonly [
  CardDockPolicy,
  boolean,
  boolean,
  CardSlotKind | null,
  CardPresentation | typeof BESIDE_RIGHT,
]

// Every combination of the policy, the marker placed or hidden, room or
// none around the marker, and the slot the card is in now: the policy
// docks first, a hidden marker hides the card in the slot it is in, and a
// floating layout floats beside the marker or docks when there is no room.
const rows: readonly Row[] = [
  ['always', true, true, null, { slot: 'docked', shown: true }],
  ['always', true, false, 'docked', { slot: 'docked', shown: true }],
  ['always', false, true, 'docked', { slot: 'docked', shown: false }],
  ['always', false, false, 'floating', { slot: 'docked', shown: false }],
  ['when-crowded', true, true, null, BESIDE_RIGHT],
  ['when-crowded', true, true, 'docked', BESIDE_RIGHT],
  ['when-crowded', true, false, 'floating', { slot: 'docked', shown: true }],
  ['when-crowded', true, false, 'docked', { slot: 'docked', shown: true }],
  ['when-crowded', false, true, 'floating', { slot: 'floating', at: null }],
  ['when-crowded', false, true, null, { slot: 'floating', at: null }],
  ['when-crowded', false, true, 'docked', { slot: 'docked', shown: false }],
  ['when-crowded', false, false, 'docked', { slot: 'docked', shown: false }],
  ['when-crowded', false, false, 'floating', { slot: 'floating', at: null }],
]

function decided(placementInput: CardPresentationInput): {
  answer: CardPresentation
  floating: FloatingCard
} {
  const floating = freshFloating()
  const answer = presentHotspotCard(placementInput, floating)
  return { answer, floating }
}

function expectedOf(
  expected: CardPresentation | typeof BESIDE_RIGHT,
  floating: FloatingCard,
): CardPresentation {
  return expected === BESIDE_RIGHT ? besideRight(floating) : expected
}

describe('presentHotspotCard', () => {
  it.each(rows)(
    'policy %s, marker placed %s, room %s, now %s',
    (policy, markerPlaced, room, current, expected) => {
      const { answer, floating } = decided(input(policy, markerPlaced, room, current))
      expect(answer).toEqual(expectedOf(expected, floating))
    },
  )

  it('floats at the spot the placement rule filled, with every field written', () => {
    const { answer } = decided(input('when-crowded', true, true, null))
    const expected = boxAt('right', marker)
    expect(answer.slot).toBe('floating')
    const at = answer.slot === 'floating' && answer.at !== null ? answer.at : null
    expect(at).not.toBeNull()
    expect(at?.left).toBe(expected.left)
    expect(at?.top).toBe(expected.top)
    expect(at?.right).toBe(expected.right)
    expect(at?.bottom).toBe(expected.bottom)
    expect(at?.left).not.toBeNaN()
    expect(at?.top).not.toBeNaN()
    expect(at?.right).not.toBeNaN()
    expect(at?.bottom).not.toBeNaN()
  })

  it('returns the caller own floating record, not a fresh one', () => {
    const { answer, floating } = decided(input('when-crowded', true, true, null))
    expect(answer).toBe(floating)
  })

  it('hides a card before the first placement pass, in the slot it is in', () => {
    const before = { ...input('when-crowded', true, true, null), stage: null }
    expect(decided(before).answer).toEqual({ slot: 'floating', at: null })
    expect(decided({ ...before, current: 'docked' }).answer).toEqual({
      slot: 'docked',
      shown: false,
    })
  })

  it('waits for the first measure before it places a floating card', () => {
    expect(decided({ ...input('when-crowded', true, true, null), card: null }).answer).toEqual({
      slot: 'floating',
      at: null,
    })
  })

  it('docks a card whose every side covers its subject', () => {
    const covered = {
      ...input('when-crowded', true, true, 'floating'),
      subject: { left: 0, top: 100, right: roomy.width, bottom: 500 },
    }
    expect(decided(covered).answer).toEqual({ slot: 'docked', shown: true })
  })

  it('docks a card whose every side covers stage chrome', () => {
    const covered = {
      ...input('when-crowded', true, true, 'floating'),
      obstacles: [{ left: 0, top: 0, right: roomy.width, bottom: roomy.height }],
    }
    expect(decided(covered).answer).toEqual({ slot: 'docked', shown: true })
  })
})

describe('presentHotspotCard for a card opened from the list', () => {
  // A list card is listed and shown in every case a marker card would hide
  // or dock: the marker hidden or placed, room or none, any policy, any
  // slot it was in.
  it.each(rows)(
    'policy %s, marker placed %s, room %s, now %s: listed',
    (policy, markerPlaced, room, current) => {
      expect(
        decided({ ...input(policy, markerPlaced, room, current), origin: 'list' }).answer,
      ).toEqual({ slot: 'listed' })
    },
  )

  it('is listed before the first pass and before any measure', () => {
    const before = { ...input('when-crowded', false, true, null), stage: null, card: null }
    expect(decided({ ...before, origin: 'list' }).answer).toEqual({ slot: 'listed' })
  })
})

describe('parseCardDockPolicy', () => {
  it('reads each declared policy', () => {
    expect(parseCardDockPolicy('always')).toBe('always')
    expect(parseCardDockPolicy('when-crowded')).toBe('when-crowded')
  })

  it('fails loudly on a value the layout cannot mean, naming it', () => {
    expect(() => parseCardDockPolicy('')).toThrow("dock policy ''")
    expect(() => parseCardDockPolicy('sometimes')).toThrow("dock policy 'sometimes'")
  })
})
