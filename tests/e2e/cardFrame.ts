// The frame rule of a captured card: an element the capture shows is whole
// or absent, never cut. An element is cut when part of its box shows and
// part does not: the card's edge, or a box that clips its overflow, takes
// a slice of it. Pure geometry over the boxes the page reports, so the rule
// is the same whatever the page holds.

export type Box = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

// One painting element of the page: its border box, and the region it can
// show through, the card intersected with every box that clips it.
export type FramedElement = {
  readonly id: string
  readonly name: string
  readonly box: Box
  readonly clip: Box
}

function area(box: Box): number {
  return Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top)
}

// The part of a box another box lets through, or null when none does.
export function intersect(one: Box, other: Box): Box | null {
  const shared = {
    left: Math.max(one.left, other.left),
    top: Math.max(one.top, other.top),
    right: Math.min(one.right, other.right),
    bottom: Math.min(one.bottom, other.bottom),
  }
  return area(shared) > 0 ? shared : null
}

// Whether the element shows in part: some of its box shows, and some of it
// is cut away. An element that shows whole, or not at all, is framed.
export function isCut(element: FramedElement): boolean {
  if (area(element.box) === 0) {
    return false
  }
  const shown = intersect(element.box, element.clip)
  return shown !== null && area(shown) < area(element.box)
}

// The elements of a capture that show in part.
export function cutElements(elements: readonly FramedElement[]): readonly FramedElement[] {
  return elements.filter(isCut)
}
