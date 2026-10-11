import { describe, expect, test } from 'vitest'
import {
  announcementCopy,
  cardWords,
  nextAnnouncement,
  type AnnouncedCard,
  type AnnouncedState,
} from './announcements'

// Neutral fixture words, never a real product's: the derivation reads
// whatever the page presents, and the real words belong to src/products/.
function state(overrides: Partial<AnnouncedState> = {}): AnnouncedState {
  return {
    product: 'sample-one',
    productName: 'Sample Two',
    finishLabel: 'Graphite',
    cameraLimits: { zoom: null, tilt: null },
    homeArrival: null,
    card: null,
    loadingReveal: 0,
    loadingWait: false,
    ...overrides,
  }
}

// The derivation with the region holding no words, the common case in the
// tests below; the clear tests pass what the region holds themselves.
function announced(previous: AnnouncedState | null, current: AnnouncedState): string | null {
  return nextAnnouncement(previous, current, '')
}

describe('nextAnnouncement', () => {
  test('a page that mounts announces nothing', () => {
    expect(announced(null, state())).toBeNull()
  })

  test('a page that only re-rendered announces nothing', () => {
    expect(announced(state(), state())).toBeNull()
  })

  test('a product change announces the new product name', () => {
    const next = state({ product: 'sample-two', productName: 'Sample Three' })

    expect(announced(state(), next)).toBe('Sample Three')
  })

  test('a finish change announces the new finish', () => {
    const next = state({ finishLabel: 'Sage Green' })

    expect(announced(state(), next)).toBe('Sage Green')
  })

  test('a product change announces the product alone, never its landing finish', () => {
    const next = state({
      product: 'sample-two',
      productName: 'Sample Three',
      finishLabel: 'Sage Green',
    })

    expect(announced(state(), next)).toBe('Sample Three')
  })

  test('two products of one name still announce the switch', () => {
    const next = state({ product: 'sample-two' })

    expect(announced(state(), next)).toBe('Sample Two')
  })

  test('another product announcing the same finish name announces the product', () => {
    const previous = state({ product: 'sample-one', finishLabel: 'Graphite' })
    const next = state({ product: 'sample-two', productName: 'Sample Three' })

    expect(announced(previous, next)).toBe('Sample Three')
  })

  test('the camera arriving home announces the home view, once per arrival', () => {
    const home = state({ homeArrival: 4 })

    expect(announced(state(), home)).toBe(announcementCopy.homeView)
    expect(announced(home, home)).toBeNull()
    expect(announced(home, state({ homeArrival: 9 }))).toBe(announcementCopy.homeView)
    expect(announced(home, state({ homeArrival: null }))).toBeNull()
  })

  test.each([
    [{ zoom: 'closest', tilt: null }, announcementCopy.zoomLimit.closest],
    [{ zoom: 'farthest', tilt: null }, announcementCopy.zoomLimit.farthest],
    [{ zoom: null, tilt: 'top' }, announcementCopy.tiltLimit.top],
    [{ zoom: null, tilt: 'bottom' }, announcementCopy.tiltLimit.bottom],
  ] as const)('a step that reaches %j names the limit', (cameraLimits, words) => {
    expect(announced(state(), state({ cameraLimits }))).toBe(words)
  })

  test('a camera that stays at a limit, or steps inside the range, announces nothing', () => {
    const atTop = state({ cameraLimits: { zoom: null, tilt: 'top' } })

    expect(announced(atTop, atTop)).toBeNull()
    expect(announced(atTop, state())).toBeNull()
    expect(announced(state(), state())).toBeNull()
  })

  test('a view presented at a limit reached nothing: idle to live announces nothing', () => {
    const idle = state({ cameraLimits: null })

    expect(announced(idle, state({ cameraLimits: { zoom: 'closest', tilt: 'top' } }))).toBeNull()
  })

  test('a step that reaches both limits names the tilt first', () => {
    const both = state({ cameraLimits: { zoom: 'closest', tilt: 'bottom' } })

    expect(announced(state(), both)).toBe(announcementCopy.tiltLimit.bottom)
  })

  test('a product change announces the product, not the limits it lands at', () => {
    const next = state({
      product: 'sample-two',
      productName: 'Sample Three',
      cameraLimits: { zoom: 'farthest', tilt: null },
      homeArrival: 2,
    })

    expect(announced(state(), next)).toBe('Sample Three')
  })

  const driverWords = cardWords('Full-range driver', ['Set behind the grille', 'Ported below'])
  const fromMarker: AnnouncedCard = { hotspot: 'driver', origin: 'marker', words: driverWords }
  const fromList: AnnouncedCard = { hotspot: 'driver', origin: 'list', words: driverWords }

  test('a card opened from a marker reads its title and bullets once', () => {
    expect(driverWords).toBe('Full-range driver. Set behind the grille. Ported below')
    expect(announced(state(), state({ card: fromMarker }))).toBe(driverWords)
    expect(announced(state({ card: fromMarker }), state({ card: fromMarker }))).toBeNull()
  })

  test('another marker card reads its own words', () => {
    const shell: AnnouncedCard = { hotspot: 'shell', origin: 'marker', words: 'Shell. Cast' }
    expect(announced(state({ card: fromMarker }), state({ card: shell }))).toBe('Shell. Cast')
  })

  test('a card opened from the list announces nothing: it sits under the focused item', () => {
    expect(announced(state(), state({ card: fromList }))).toBeNull()
  })

  test('a list card a marker press moves to the stage reads its words', () => {
    expect(announced(state({ card: fromList }), state({ card: fromMarker }))).toBe(driverWords)
  })

  test('a card that closes announces nothing', () => {
    expect(announced(state({ card: fromMarker }), state())).toBeNull()
  })

  test('the loading readout revealing announces the loading word, once per reveal', () => {
    const revealed = state({ loadingReveal: 1 })

    expect(announced(state(), revealed)).toBe(announcementCopy.loading)
    expect(announced(revealed, revealed)).toBeNull()
    expect(announced(revealed, state({ loadingReveal: 2 }))).toBe(announcementCopy.loading)
  })

  test('a count that holds announces nothing, whatever the wait around it did', () => {
    expect(announced(state({ loadingReveal: 3 }), state({ loadingReveal: 3 }))).toBeNull()
  })

  test('the wait ending takes the loading word out, with no completion word', () => {
    const waiting = state({ loadingWait: true })

    expect(nextAnnouncement(waiting, state(), announcementCopy.loading)).toBe('')
    // The region holding anything else, or nothing, owes no clear.
    expect(nextAnnouncement(waiting, state(), 'Sample Three')).toBeNull()
    expect(announced(waiting, state())).toBeNull()
    // A wait that never ran leaves nothing to clear: no message at all.
    expect(nextAnnouncement(state(), state(), announcementCopy.loading)).toBeNull()
  })

  // Every announcement a diff owes wins over the clear the same diff's
  // ended wait would otherwise make: the clear takes only the loading word.
  test.each([
    [
      'the product name',
      state({ loadingWait: true }),
      state({ product: 'sample-two', productName: 'Sample Three' }),
      'Sample Three',
    ],
    [
      'the finish name',
      state({ loadingWait: true }),
      state({ finishLabel: 'Sage Green' }),
      'Sage Green',
    ],
    [
      'the marker card words',
      state({ loadingWait: true }),
      state({ card: fromMarker }),
      driverWords,
    ],
    [
      'the loading reveal',
      state({ loadingWait: true }),
      state({ loadingReveal: 1 }),
      announcementCopy.loading,
    ],
    [
      'the home arrival',
      state({ loadingWait: true, homeArrival: 1 }),
      state({ homeArrival: 2 }),
      announcementCopy.homeView,
    ],
    [
      'the reached limit',
      state({ loadingWait: true, cameraLimits: { zoom: null, tilt: null } }),
      state({ cameraLimits: { zoom: 'closest', tilt: null } }),
      announcementCopy.zoomLimit.closest,
    ],
  ])('a diff that ends the wait still announces %s', (_name, waiting, ended, words) => {
    expect(nextAnnouncement(waiting, ended, announcementCopy.loading)).toBe(words)
  })

  test('a reveal is not outranked by an arrival in the same diff', () => {
    const waiting = state({ loadingWait: true, homeArrival: 1 })
    const revealed = state({ loadingReveal: 1, homeArrival: 2 })

    expect(announced(waiting, revealed)).toBe(announcementCopy.loading)
  })
})
