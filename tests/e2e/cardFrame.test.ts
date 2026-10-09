import { describe, expect, it } from 'vitest'
import { cutElements, intersect, isCut } from './cardFrame'
import type { Box, FramedElement } from './cardFrame'

const card: Box = { left: 0, top: 0, right: 1200, bottom: 630 }

function element(name: string, box: Box, clip: Box = card): FramedElement {
  return { id: name, name, box, clip }
}

describe('intersect', () => {
  it('returns the shared part of two boxes, or null when they share no area', () => {
    expect(
      intersect(
        { left: 0, top: 0, right: 10, bottom: 10 },
        { left: 5, top: 5, right: 20, bottom: 20 },
      ),
    ).toEqual({
      left: 5,
      top: 5,
      right: 10,
      bottom: 10,
    })
    expect(
      intersect(
        { left: 0, top: 0, right: 10, bottom: 10 },
        { left: 10, top: 0, right: 20, bottom: 10 },
      ),
    ).toBeNull()
  })
})

describe('isCut', () => {
  it('frames an element that shows whole', () => {
    expect(isCut(element('whole', { left: 32, top: 100, right: 300, bottom: 140 }))).toBe(false)
  })

  it('frames an element that shows not at all, past the edge or past its clip', () => {
    expect(isCut(element('below', { left: 32, top: 640, right: 300, bottom: 660 }))).toBe(false)
    expect(
      isCut(
        element(
          'scrolled away',
          { left: 32, top: 580, right: 300, bottom: 600 },
          { left: 0, top: 56, right: 408, bottom: 560 },
        ),
      ),
    ).toBe(false)
  })

  it('cuts an element the card edge slices, on any side', () => {
    expect(isCut(element('bottom', { left: 32, top: 616, right: 344, bottom: 646 }))).toBe(true)
    expect(isCut(element('right', { left: 1180, top: 10, right: 1220, bottom: 40 }))).toBe(true)
    expect(isCut(element('top', { left: 10, top: -10, right: 40, bottom: 20 }))).toBe(true)
    expect(isCut(element('left', { left: -5, top: 10, right: 40, bottom: 20 }))).toBe(true)
  })

  it('cuts an element a clipping box slices inside the card', () => {
    expect(
      isCut(
        element(
          'scroller',
          { left: 32, top: 550, right: 344, bottom: 580 },
          { left: 0, top: 56, right: 408, bottom: 560 },
        ),
      ),
    ).toBe(true)
  })

  it('frames an empty box', () => {
    expect(isCut(element('empty', { left: 1190, top: 620, right: 1190, bottom: 640 }))).toBe(false)
  })
})

describe('cutElements', () => {
  it('lists the cut elements only, in their order', () => {
    const elements = [
      element('whole', { left: 0, top: 0, right: 10, bottom: 10 }),
      element('sliced', { left: 0, top: 620, right: 10, bottom: 640 }),
      element('gone', { left: 0, top: 640, right: 10, bottom: 650 }),
    ]
    expect(cutElements(elements).map((cut) => cut.name)).toEqual(['sliced'])
  })
})
