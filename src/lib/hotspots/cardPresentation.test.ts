import { describe, expect, it } from 'vitest'
import { cardBoxAt, type CardMetrics } from './cardPlacement'
import {
  parseCardDockPolicy,
  presentHotspotCard,
  type CardDockPolicy,
  type CardPresentation,
  type CardPresentationInput,
  type CardSlotKind,
} from './cardPresentation'

const metrics: CardMetrics = { markerHitPx: 44, cardOffsetPx: 8, focusOutsetPx: 5 }
const marker = { x: 400, y: 300 }
const card = { width: 200, height: 100 }
const roomy = { width: 800, height: 600 }
// A stage with no side that fits the card around its marker.
const cramped = { width: 250, height: 200 }
const crampedMarker = { x: 125, y: 100 }

const beside: CardPresentation = {
  slot: 'floating',
  at: { side: 'right', box: cardBoxAt('right', marker, card, metrics) },
}
const floatingHidden: CardPresentation = { slot: 'floating', at: null }
const dockedShown: CardPresentation = { slot: 'docked', shown: true }
const dockedHidden: CardPresentation = { slot: 'docked', shown: false }

function input(
  policy: CardDockPolicy,
  markerPlaced: boolean,
  room: boolean,
  current: CardSlotKind | null,
): CardPresentationInput {
  const at = room ? marker : crampedMarker
  return {
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

type Row = readonly [CardDockPolicy, boolean, boolean, CardSlotKind | null, CardPresentation]

// Every combination of the policy, the marker placed or hidden, room or
// none around the marker, and the slot the card is in now: the policy
// docks first, a hidden marker hides the card in the slot it is in, and a
// floating layout floats beside the marker or docks when there is no room.
const rows: readonly Row[] = [
  ['always', true, true, null, dockedShown],
  ['always', true, false, 'docked', dockedShown],
  ['always', false, true, 'docked', dockedHidden],
  ['always', false, false, 'floating', dockedHidden],
  ['when-crowded', true, true, null, beside],
  ['when-crowded', true, true, 'docked', beside],
  ['when-crowded', true, false, 'floating', dockedShown],
  ['when-crowded', true, false, 'docked', dockedShown],
  ['when-crowded', false, true, 'floating', floatingHidden],
  ['when-crowded', false, true, null, floatingHidden],
  ['when-crowded', false, true, 'docked', dockedHidden],
  ['when-crowded', false, false, 'docked', dockedHidden],
  ['when-crowded', false, false, 'floating', floatingHidden],
]

describe('presentHotspotCard', () => {
  it.each(rows)(
    'policy %s, marker placed %s, room %s, now %s',
    (policy, markerPlaced, room, current, expected) => {
      expect(presentHotspotCard(input(policy, markerPlaced, room, current))).toEqual(expected)
    },
  )

  it('hides a card before the first placement pass, in the slot it is in', () => {
    const before = { ...input('when-crowded', true, true, null), stage: null }
    expect(presentHotspotCard(before)).toEqual(floatingHidden)
    expect(presentHotspotCard({ ...before, current: 'docked' })).toEqual(dockedHidden)
  })

  it('waits for the first measure before it places a floating card', () => {
    expect(presentHotspotCard({ ...input('when-crowded', true, true, null), card: null })).toEqual(
      floatingHidden,
    )
  })

  it('docks a card whose every side covers its subject', () => {
    const covered = {
      ...input('when-crowded', true, true, 'floating'),
      subject: { left: 0, top: 100, right: roomy.width, bottom: 500 },
    }
    expect(presentHotspotCard(covered)).toEqual(dockedShown)
  })

  it('docks a card whose every side covers stage chrome', () => {
    const covered = {
      ...input('when-crowded', true, true, 'floating'),
      obstacles: [{ left: 0, top: 0, right: roomy.width, bottom: roomy.height }],
    }
    expect(presentHotspotCard(covered)).toEqual(dockedShown)
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
