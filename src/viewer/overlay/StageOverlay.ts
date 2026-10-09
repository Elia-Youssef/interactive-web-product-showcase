// The stage's overlay channel: one instance per stage mount, created beside
// the settle, the holds and the probes. It knows keys and placements, never
// what the overlay shows: DOM content registers an element under a key, and
// the stage's canvas content writes a placement for the key per presented
// frame. A placement is written straight to the element's style, so a frame
// allocates no React state and re-renders nothing.
//
// The canvas side writes one presented frame's placements as one pass, in
// the overlay box that frame used. Once every placement of the pass is
// written, the pass listeners run in two phases. The presenters run first:
// overlay content that positions itself against the placed elements (the
// open hotspot card) decides there, over the complete set of the frame,
// with no frame of its own. The observers run after every presenter, so
// what they read is the frame's final placements, whichever order the
// listeners subscribed in. The last pass's box and every key's last
// placement stay readable, so a presenter can also decide between frames,
// when its own size changes.

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

// Which point of a mounted element a placement puts at the stage position:
// its center (a marker sits centered on its projection) or its top-left
// corner (a box placed by its own edges). The center is a translate by half
// the element's own size, which WebKit resolves against the element's
// pixel-snapped box, so an element of fractional size lands up to half a
// pixel off; an element whose placer computes its edges exactly mounts by
// its top-left corner and takes no percentage translate.
export type OverlayOrigin = 'center' | 'top-left'

type OverlayMount = {
  readonly element: OverlayElement
  readonly origin: OverlayOrigin
}

// The box the placements are measured in: the stage's canvas box in CSS
// pixels, which the overlay box covers exactly.
export type OverlayBox = {
  readonly width: number
  readonly height: number
}

// An axis-aligned rect over the stage, the extent of something the canvas
// side measured, never an element's own box: placements move mounted
// elements, boxes only publish geometry.
export type OverlayRect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type OverlayPlace = (key: string, placement: OverlayPlacement) => void

export type OverlayPlaceBox = (key: string, box: OverlayRect) => void

export type OverlayPassListener = () => void

// The phase a pass listener runs in: a presenter places elements of its own
// from the pass, an observer only reads the pass's final placements.
export type OverlayPassPhase = 'presenter' | 'observer'

export type OverlayPassRelease = () => void

// The records the overlay holds for the product on the stage, held as one
// state and replaced whole when the content leaves: a record kind a later
// change adds to this state is cleared with the rest, never forgotten in
// the clear.
type OverlayProductState = {
  // The last placement written per key, so a write that lands before its
  // element registers is not lost, and a remounted element re-enters at the
  // key's current placement.
  readonly placements: Map<string, OverlayPlacement>
  // The last box written per key: published geometry, with no element to
  // apply it to, so it only needs to answer between passes.
  readonly boxes: Map<string, OverlayRect>
}

function emptyOverlayProductState(): OverlayProductState {
  return { placements: new Map(), boxes: new Map() }
}

export class StageOverlay {
  private mounts = new Map<string, OverlayMount>()
  private product: OverlayProductState = emptyOverlayProductState()
  private readonly passListeners: Readonly<Record<OverlayPassPhase, Set<OverlayPassListener>>> = {
    presenter: new Set(),
    observer: new Set(),
  }
  private passBox: OverlayBox | null = null
  // The one write function a pass hands its writer, bound once, so a frame's
  // pass allocates no closure.
  private readonly placeInPass: OverlayPlace = (key, placement) => this.place(key, placement)
  private readonly placeBoxInPass: OverlayPlaceBox = (key, box) => this.placeBox(key, box)

  // Holds the element under the key for as long as the caller keeps it and
  // returns the release of this one mount. A second mount under a held key
  // is a composition error, and a stale release fails loudly, like the
  // probes' release: a cleanup that is no longer its key's mount must never
  // drop an element a later mount installed. The release drops the element,
  // never the key's placement: the placement is the canvas side's truth
  // about the key, and a remounted element, React's double mount included,
  // re-enters at the key's current placement instead of flashing hidden
  // until a frame that a resting stage may never render.
  mount(key: string, element: OverlayElement, origin: OverlayOrigin): OverlayMountRelease {
    if (this.mounts.has(key)) {
      throw new Error(`the overlay key '${key}' is already held`)
    }
    const mount = { element, origin }
    this.mounts.set(key, mount)
    this.apply(key, mount)
    return () => {
      if (this.mounts.get(key) !== mount) {
        throw new Error(
          `the release of the overlay key '${key}' is stale: its mount no longer holds the key`,
        )
      }
      this.mounts.delete(key)
    }
  }

  // Writes the placement of the key: a placed element puts its mount's
  // origin on the stage position, a hidden one is invisible, unclickable,
  // unfocusable and out of the accessibility tree. Hidden is `visibility`,
  // never `display`, so hiding and showing never restarts the element's CSS
  // animations. An element is hidden until its first placement, so it never
  // flashes at the box's corner.
  place(key: string, placement: OverlayPlacement): void {
    this.product.placements.set(key, placement)
    const mount = this.mounts.get(key)
    if (mount !== undefined) {
      this.apply(key, mount)
    }
  }

  // Takes the product's records off the channel, whole: the content that
  // owned them has left the stage, and the next content must read nothing
  // of it, whichever record kind it left behind.
  clearProductState(): void {
    this.product = emptyOverlayProductState()
  }

  // Writes one presented frame's placements and boxes as one pass in the
  // given box: the writer places every key of the frame, then every
  // presenter runs once, in subscription order, with the whole set written,
  // then every observer runs once, in subscription order, after the
  // presenters.
  pass(box: OverlayBox, writeAll: (place: OverlayPlace, placeBox: OverlayPlaceBox) => void): void {
    this.passBox = box
    writeAll(this.placeInPass, this.placeBoxInPass)
    for (const listener of this.passListeners.presenter) {
      listener()
    }
    for (const listener of this.passListeners.observer) {
      listener()
    }
  }

  // Publishes the box of the key: measured geometry over the stage, read by
  // whoever decides against it, never applied to a mounted element.
  placeBox(key: string, box: OverlayRect): void {
    this.product.boxes.set(key, box)
  }

  // The last box written for the key, or null when none was.
  boxOf(key: string): OverlayRect | null {
    return this.product.boxes.get(key) ?? null
  }

  // Holds the listener in its phase for as long as the caller keeps it and
  // returns the release of this one subscription. A release that no longer
  // holds its listener fails loudly, like a stale mount release.
  onPass(listener: OverlayPassListener, phase: OverlayPassPhase): OverlayPassRelease {
    const listeners = this.passListeners[phase]
    listeners.add(listener)
    return () => {
      if (!listeners.delete(listener)) {
        throw new Error('the release of an overlay pass listener is stale')
      }
    }
  }

  // The box of the last pass, or null before the first.
  lastPassBox(): OverlayBox | null {
    return this.passBox
  }

  // The last placement written for the key, or null when none was.
  placementOf(key: string): OverlayPlacement | null {
    return this.product.placements.get(key) ?? null
  }

  // Every key's last placement, as a record read at access time: the keys
  // the canvas side has written, and nothing else. The read is off the
  // frame path, so it builds a fresh record on every call.
  placementRecord(): Readonly<Record<string, OverlayPlacement>> {
    return Object.fromEntries(this.product.placements)
  }

  private apply(key: string, { element, origin }: OverlayMount): void {
    const placement = this.product.placements.get(key)
    if (placement === undefined || placement.kind === 'hidden') {
      element.style.visibility = 'hidden'
      return
    }
    element.style.visibility = 'visible'
    const to = `translate(${placement.x}px, ${placement.y}px)`
    element.style.transform = origin === 'center' ? `${to} translate(-50%, -50%)` : to
  }
}
