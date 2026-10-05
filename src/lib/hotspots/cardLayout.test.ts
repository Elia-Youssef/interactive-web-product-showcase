import { describe, expect, it } from 'vitest'
import { cardLayoutProperties, readCardLayout, type CustomPropertyRead } from './cardLayout'

// A computed style stand-in over the custom properties the layout reads,
// with the leading space a computed custom property can carry.
function styleOf(values: Readonly<Record<string, string>>): CustomPropertyRead {
  return { getPropertyValue: (property) => values[property] ?? '' }
}

const tokens = {
  [cardLayoutProperties.dockPolicy]: ' when-crowded',
  [cardLayoutProperties.markerHit]: ' 44px',
  [cardLayoutProperties.cardOffset]: '8px',
  [cardLayoutProperties.focusWidth]: '2px',
  [cardLayoutProperties.markerRingOffset]: '3px',
}

describe('readCardLayout', () => {
  it('reads the policy and the metrics, the ring reaching its offset plus its width', () => {
    expect(readCardLayout(styleOf(tokens))).toEqual({
      policy: 'when-crowded',
      metrics: { markerHitPx: 44, cardOffsetPx: 8, focusOutsetPx: 5 },
    })
  })

  it('reads the ring reach from the marker ring offset token, so a wider ring keeps more clear', () => {
    expect(
      readCardLayout(styleOf({ ...tokens, [cardLayoutProperties.markerRingOffset]: '6px' })).metrics
        .focusOutsetPx,
    ).toBe(8)
  })

  it('reads the docking policy the phone layout declares', () => {
    expect(
      readCardLayout(styleOf({ ...tokens, [cardLayoutProperties.dockPolicy]: 'always' })).policy,
    ).toBe('always')
  })

  it('fails loudly on a length that is not px, naming the property', () => {
    expect(() =>
      readCardLayout(styleOf({ ...tokens, [cardLayoutProperties.cardOffset]: '0.5rem' })),
    ).toThrow(`${cardLayoutProperties.cardOffset} must compute to a px length`)
  })

  it('fails loudly on a missing property', () => {
    expect(() =>
      readCardLayout(styleOf({ ...tokens, [cardLayoutProperties.markerHit]: '' })),
    ).toThrow(cardLayoutProperties.markerHit)
    expect(() =>
      readCardLayout(styleOf({ ...tokens, [cardLayoutProperties.dockPolicy]: '' })),
    ).toThrow('dock policy')
  })
})
