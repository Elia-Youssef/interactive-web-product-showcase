import { describe, expect, it } from 'vitest'
import { scrollTarget } from './scrollTarget'

describe('scroll target geometry', () => {
  const axis = { position: 20, maximum: 200, start: 100, end: 400, viewStart: 30, viewEnd: 130 }
  it('aligns the start of tall content to the scrollport after margins and padding', () => {
    expect(scrollTarget(axis, 'start')).toBe(90)
    expect(scrollTarget({ ...axis, start: 500 }, 'start')).toBe(200)
    expect(scrollTarget({ ...axis, start: -100 }, 'start')).toBe(0)
  })
  it.each([
    { start: 40, end: 100, expected: 20 },
    { start: 20, end: 150, expected: 20 },
    { start: 140, end: 160, expected: 50 },
    { start: 10, end: 20, expected: 0 },
  ])('nearest alignment uses actual target edges: $start..$end', ({ start, end, expected }) => {
    expect(scrollTarget({ ...axis, start, end }, 'nearest')).toBe(expected)
  })

  it('nearest alignment preserves the nearer edge of content larger than the scrollport', () => {
    expect(
      scrollTarget({ ...axis, position: 200, maximum: 500, start: 10, end: 120 }, 'nearest'),
    ).toBe(190)
    expect(scrollTarget({ ...axis, maximum: 500, start: 40, end: 400 }, 'nearest')).toBe(30)
  })

  it.each([
    { start: 90, end: 130.25, expected: 21 },
    { start: 90, end: 130.75, expected: 21 },
    { start: 29.75, end: 60, expected: 19 },
    { start: 29.25, end: 60, expected: 19 },
  ])(
    'fully exposes fitting content at fractional edges: $start..$end',
    ({ start, end, expected }) => {
      expect(scrollTarget({ ...axis, start, end }, 'nearest')).toBe(expected)
    },
  )

  it.each([
    { start: 100.25, expected: 90 },
    { start: 100.5, expected: 91 },
    { start: 100.75, expected: 91 },
  ])('requests an exactly representable native scroll target at $start', ({ start, expected }) => {
    expect(scrollTarget({ ...axis, start }, 'start')).toBe(expected)
    expect(scrollTarget({ ...axis, start, end: start + 300 }, 'nearest')).toBe(expected)
  })
})
