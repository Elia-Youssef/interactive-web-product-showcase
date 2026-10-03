import { describe, expect, it } from 'vitest'
import {
  cardBoxAt,
  markerKeepOut,
  placeHotspotCard,
  type CardMetrics,
  type CardPlacement,
  type CardPlacementInput,
  type StagePoint,
} from './cardPlacement'
import type { StageBox } from './projection'

// The metrics of the cases: a 44 px hit box, the card 8 px off it, and a
// ring reaching 5 px outside the hit box. A marker's keep-out box is then
// 54 px square, and a card hangs 30 px off its marker's center.
const metrics: CardMetrics = { markerHitPx: 44, cardOffsetPx: 8, focusOutsetPx: 5 }
const card = { width: 200, height: 100 }
const stage: StageBox = { width: 800, height: 600 }
const center: StagePoint = { x: 400, y: 300 }

function input(overrides: Partial<CardPlacementInput>): CardPlacementInput {
  const marker = overrides.marker ?? center
  return {
    stage,
    marker,
    placedMarkers: [marker],
    obstacles: [],
    card,
    metrics,
    ...overrides,
  }
}

function sideOf(placement: CardPlacement): string {
  return placement.kind === 'beside' ? placement.side : 'docked'
}

describe('cardBoxAt', () => {
  it('hangs the card the offset off the hit box, centered across the side axis', () => {
    expect(cardBoxAt('right', center, card, metrics)).toEqual({
      left: 430,
      top: 250,
      right: 630,
      bottom: 350,
    })
    expect(cardBoxAt('left', center, card, metrics)).toEqual({
      left: 170,
      top: 250,
      right: 370,
      bottom: 350,
    })
    expect(cardBoxAt('below', center, card, metrics)).toEqual({
      left: 300,
      top: 330,
      right: 500,
      bottom: 430,
    })
    expect(cardBoxAt('above', center, card, metrics)).toEqual({
      left: 300,
      top: 170,
      right: 500,
      bottom: 270,
    })
  })
})

describe('markerKeepOut', () => {
  it('grows the hit box by the ring reach on every side', () => {
    expect(markerKeepOut(center, metrics)).toEqual({
      left: 373,
      top: 273,
      right: 427,
      bottom: 327,
    })
  })
})

// Each row: what the case shows, the input, and the side it lands on. The
// rows walk the preference order (each side chosen once the sides before
// it are rejected) and every rejection reason: the stage edge, another
// marker's hit box, another marker's focus ring alone, and the card's own
// marker's ring.
const rows: readonly (readonly [string, CardPlacementInput, string])[] = [
  ['an open stage takes the first side', input({}), 'right'],
  [
    'the right side leaving the stage falls to the left',
    input({ marker: { x: 700, y: 300 } }),
    'left',
  ],
  [
    'both beside sides leaving a narrow stage fall to below',
    input({ stage: { width: 300, height: 600 }, marker: { x: 150, y: 300 } }),
    'below',
  ],
  [
    'the stage floor rejecting below too falls to above',
    input({ stage: { width: 300, height: 600 }, marker: { x: 150, y: 550 } }),
    'above',
  ],
  [
    'a stage too small for every side docks',
    input({ stage: { width: 250, height: 200 }, marker: { x: 125, y: 100 } }),
    'docked',
  ],
  [
    'a card exactly flush with the stage edge is inside it',
    input({ stage: { width: 630, height: 600 } }),
    'right',
  ],
  [
    'a card one hundredth of a pixel past the stage edge is outside it',
    input({ stage: { width: 629.99, height: 600 } }),
    'left',
  ],
  [
    'a card covering another marker hit box moves to the next side',
    input({ placedMarkers: [center, { x: 530, y: 300 }] }),
    'left',
  ],
  [
    'a card covering only another marker focus ring moves to the next side',
    input({ placedMarkers: [center, { x: 654, y: 300 }] }),
    'left',
  ],
  [
    'a card that only touches another marker keep-out box covers nothing',
    input({ placedMarkers: [center, { x: 657, y: 300 }] }),
    'right',
  ],
  [
    'markers on both beside sides fall to below',
    input({ placedMarkers: [center, { x: 530, y: 300 }, { x: 270, y: 300 }] }),
    'below',
  ],
  [
    'markers on three sides fall to above',
    input({
      placedMarkers: [center, { x: 530, y: 300 }, { x: 270, y: 300 }, { x: 400, y: 400 }],
    }),
    'above',
  ],
  [
    'markers on every side dock',
    input({
      placedMarkers: [
        center,
        { x: 530, y: 300 },
        { x: 270, y: 300 },
        { x: 400, y: 400 },
        { x: 400, y: 200 },
      ],
    }),
    'docked',
  ],
  [
    'a card covering a chrome obstacle moves to the next side',
    input({ obstacles: [{ left: 600, top: 320, right: 700, bottom: 360 }] }),
    'left',
  ],
  [
    'a card that only touches a chrome obstacle covers nothing',
    input({ obstacles: [{ left: 630, top: 300, right: 700, bottom: 360 }] }),
    'right',
  ],
  [
    'chrome over every side docks',
    input({
      obstacles: [
        { left: 600, top: 320, right: 700, bottom: 360 },
        { left: 150, top: 320, right: 200, bottom: 360 },
        { left: 450, top: 400, right: 480, bottom: 420 },
        { left: 450, top: 180, right: 480, bottom: 200 },
      ],
    }),
    'docked',
  ],
  [
    'an offset inside the ring reach would cover the card own marker ring on every side',
    input({ metrics: { markerHitPx: 44, cardOffsetPx: 2, focusOutsetPx: 5 } }),
    'docked',
  ],
]

describe('placeHotspotCard', () => {
  it.each(rows)('%s', (_why, placementInput, expected) => {
    expect(sideOf(placeHotspotCard(placementInput))).toBe(expected)
  })

  it('answers the box of the side it chose', () => {
    const placement = placeHotspotCard(input({ marker: { x: 700, y: 300 } }))
    expect(placement).toEqual({
      kind: 'beside',
      side: 'left',
      box: cardBoxAt('left', { x: 700, y: 300 }, card, metrics),
    })
  })

  it('never answers a box outside the stage or over a keep-out box, over a dense grid of cases', () => {
    const others: StagePoint[] = [
      { x: 120, y: 90 },
      { x: 610, y: 140 },
      { x: 330, y: 470 },
    ]
    for (let x = 0; x <= stage.width; x += 25) {
      for (let y = 0; y <= stage.height; y += 25) {
        const marker = { x, y }
        const placement = placeHotspotCard(input({ marker, placedMarkers: [marker, ...others] }))
        if (placement.kind === 'docked') {
          continue
        }
        const { box } = placement
        expect(box.left).toBeGreaterThanOrEqual(0)
        expect(box.top).toBeGreaterThanOrEqual(0)
        expect(box.right).toBeLessThanOrEqual(stage.width)
        expect(box.bottom).toBeLessThanOrEqual(stage.height)
        for (const placed of [marker, ...others]) {
          const keepOut = markerKeepOut(placed, metrics)
          const covers =
            box.left < keepOut.right &&
            keepOut.left < box.right &&
            box.top < keepOut.bottom &&
            keepOut.top < box.bottom
          expect(covers).toBe(false)
        }
      }
    }
  })
})
