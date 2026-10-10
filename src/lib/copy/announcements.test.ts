import { describe, expect, test } from 'vitest'
import { announcementCopy, nextAnnouncement, type AnnouncedState } from './announcements'

// Neutral fixture words, never a real product's: the derivation reads
// whatever the page presents, and the real words belong to src/products/.
function state(overrides: Partial<AnnouncedState> = {}): AnnouncedState {
  return {
    product: 'sample-one',
    productName: 'Sample Two',
    finishLabel: 'Graphite',
    cameraLimits: { zoom: null, tilt: null },
    homeArrival: null,
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

  test('the camera arriving home announces the home view, once per arrival', () => {
    const home = state({ homeArrival: 4 })

    expect(nextAnnouncement(state(), home)).toBe(announcementCopy.homeView)
    expect(nextAnnouncement(home, home)).toBeNull()
    expect(nextAnnouncement(home, state({ homeArrival: 9 }))).toBe(announcementCopy.homeView)
    expect(nextAnnouncement(home, state({ homeArrival: null }))).toBeNull()
  })

  test.each([
    [{ zoom: 'closest', tilt: null }, announcementCopy.zoomLimit.closest],
    [{ zoom: 'farthest', tilt: null }, announcementCopy.zoomLimit.farthest],
    [{ zoom: null, tilt: 'top' }, announcementCopy.tiltLimit.top],
    [{ zoom: null, tilt: 'bottom' }, announcementCopy.tiltLimit.bottom],
  ] as const)('a step that reaches %j names the limit', (cameraLimits, words) => {
    expect(nextAnnouncement(state(), state({ cameraLimits }))).toBe(words)
  })

  test('a camera that stays at a limit, or steps inside the range, announces nothing', () => {
    const atTop = state({ cameraLimits: { zoom: null, tilt: 'top' } })

    expect(nextAnnouncement(atTop, atTop)).toBeNull()
    expect(nextAnnouncement(atTop, state())).toBeNull()
    expect(nextAnnouncement(state(), state())).toBeNull()
  })

  test('a view presented at a limit reached nothing: idle to live announces nothing', () => {
    const idle = state({ cameraLimits: null })

    expect(
      nextAnnouncement(idle, state({ cameraLimits: { zoom: 'closest', tilt: 'top' } })),
    ).toBeNull()
  })

  test('a step that reaches both limits names the tilt first', () => {
    const both = state({ cameraLimits: { zoom: 'closest', tilt: 'bottom' } })

    expect(nextAnnouncement(state(), both)).toBe(announcementCopy.tiltLimit.bottom)
  })

  test('a product change announces the product, not the limits it lands at', () => {
    const next = state({
      product: 'sample-two',
      productName: 'Sample Three',
      cameraLimits: { zoom: 'farthest', tilt: null },
      homeArrival: 2,
    })

    expect(nextAnnouncement(state(), next)).toBe('Sample Three')
  })
})
