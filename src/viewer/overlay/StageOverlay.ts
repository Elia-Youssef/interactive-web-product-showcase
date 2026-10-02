// The stage's overlay channel: one instance per stage mount, created beside
// the settle, the holds and the probes. It knows keys and placements, never
// what the overlay shows: DOM content registers an element under a key, and
// the stage's canvas content writes a placement for the key per presented
// frame. A placement is written straight to the element's style, so a frame
// allocates no React state and re-renders nothing.

// The surface the channel writes: exactly the two style properties a
// placement moves. A real element's style satisfies it, and so does a test
// stand-in, because the channel touches nothing else.
export type OverlayElement = {
  readonly style: {
    visibility: string
    transform: string
  }
}

export type OverlayPlacement =
  { readonly kind: 'placed'; readonly x: number; readonly y: number } | { readonly kind: 'hidden' }

export type OverlayMountRelease = () => void

export class StageOverlay {
  private elements = new Map<string, OverlayElement>()
  // The last placement written per key, so a write that lands before its
  // element registers is not lost, and a remounted element re-enters at the
  // key's current placement.
  private placements = new Map<string, OverlayPlacement>()

  // Holds the element under the key for as long as the caller keeps it and
  // returns the release of this one mount. A second mount under a held key
  // is a composition error, and a stale release fails loudly, like the
  // probes' release: a cleanup that is no longer its key's mount must never
  // drop an element a later mount installed. The release drops the element,
  // never the key's placement: the placement is the canvas side's truth
  // about the key, and a remounted element, React's double mount included,
  // re-enters at the key's current placement instead of flashing hidden
  // until a frame that a resting stage may never render.
  mount(key: string, element: OverlayElement): OverlayMountRelease {
    if (this.elements.has(key)) {
      throw new Error(`the overlay key '${key}' is already held`)
    }
    this.elements.set(key, element)
    this.apply(key, element)
    return () => {
      if (this.elements.get(key) !== element) {
        throw new Error(
          `the release of the overlay key '${key}' is stale: its mount no longer holds the key`,
        )
      }
      this.elements.delete(key)
    }
  }

  // Writes the placement of the key: a placed element sits centered on the
  // stage position, a hidden one is invisible, unclickable, unfocusable and
  // out of the accessibility tree. Hidden is `visibility`, never `display`,
  // so hiding and showing never restarts the element's CSS animations. An
  // element is hidden until its first placement, so it never flashes at the
  // box's corner.
  place(key: string, placement: OverlayPlacement): void {
    this.placements.set(key, placement)
    const element = this.elements.get(key)
    if (element !== undefined) {
      this.apply(key, element)
    }
  }

  private apply(key: string, element: OverlayElement): void {
    const placement = this.placements.get(key)
    if (placement === undefined || placement.kind === 'hidden') {
      element.style.visibility = 'hidden'
      return
    }
    element.style.visibility = 'visible'
    element.style.transform = `translate(${placement.x}px, ${placement.y}px) translate(-50%, -50%)`
  }
}
