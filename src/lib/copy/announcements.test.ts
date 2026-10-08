import { describe, expect, test } from 'vitest'
import { nextAnnouncement, type AnnouncedState } from './announcements'

// Neutral fixture words, never a real product's: the derivation reads
// whatever the page presents, and the real words belong to src/products/.
function state(overrides: Partial<AnnouncedState> = {}): AnnouncedState {
  return {
    product: 'sample-one',
    productName: 'Sample Two',
    finishLabel: 'Graphite',
    ...overrides,
  }
}

describe('nextAnnouncement', () => {
  test('a page that mounts announces nothing', () => {
    expect(nextAnnouncement(null, state())).toBeNull()
  })

  test('a page that only re-rendered announces nothing', () => {
    expect(nextAnnouncement(state(), state())).toBeNull()
  })

  test('a product change announces the new product name', () => {
    const next = state({ product: 'sample-two', productName: 'Sample Three' })

    expect(nextAnnouncement(state(), next)).toBe('Sample Three')
  })

  test('a finish change announces the new finish', () => {
    const next = state({ finishLabel: 'Sage Green' })

    expect(nextAnnouncement(state(), next)).toBe('Sage Green')
  })

  test('a product change announces the product alone, never its landing finish', () => {
    const next = state({
      product: 'sample-two',
      productName: 'Sample Three',
      finishLabel: 'Sage Green',
    })

    expect(nextAnnouncement(state(), next)).toBe('Sample Three')
  })

  test('two products of one name still announce the switch', () => {
    const next = state({ product: 'sample-two' })

    expect(nextAnnouncement(state(), next)).toBe('Sample Two')
  })

  test('another product announcing the same finish name announces the product', () => {
    const previous = state({ product: 'sample-one', finishLabel: 'Graphite' })
    const next = state({ product: 'sample-two', productName: 'Sample Three' })

    expect(nextAnnouncement(previous, next)).toBe('Sample Three')
  })
})
