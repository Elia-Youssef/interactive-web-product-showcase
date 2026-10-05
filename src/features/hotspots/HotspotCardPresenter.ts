import type { BoxSize } from '@lib/hotspots/cardPlacement'
import type { StagePoint, StageRect } from '@lib/hotspots/markerBox'
import { presentHotspotCard, type CardPresentation } from '@lib/hotspots/cardPresentation'
import type { OverlayBox, OverlayPlacement, StageOverlay } from '@viewer/overlay/StageOverlay'
import type { CardLayout } from '@lib/hotspots/cardLayout'
import { CARD_OVERLAY_KEY, overlayKey } from '@lib/hotspots/hotspotKeys'

// The one owner of where the open hotspot card goes, for one product's
// markers on one stage. It decides through the pure presentation rule, from
// the stage overlay's last pass (the stage box and every marker's
// placement), the layout the stylesheets declare, the stage chrome boxes,
// and the floating card's measured size. It decides at the end of every
// overlay pass, after the frame's markers are written, and when the card's
// selection, its size or the chrome changes, which happens with no frame at
// all: opening a card renders nothing on the stage.
//
// The layout and the chrome boxes change only with the stage box (a
// breakpoint is crossed by resizing, and the chrome sits at the stage
// edges) or on their own resize, so they are read on a selection, a
// measure, a chrome change and a pass whose stage box changed size, and
// kept between: a pass of a moving camera reads no style.
//
// A floating card is the overlay element under the card key, placed by the
// top-left corner of the box the rule chose, so it rides the overlay's own
// writer, hidden included, with no React render. The card's slot (floating
// in the overlay or docked in the layout's dock) and a docked card's shown
// state are React state, published through subscribe and snapshot for
// useSyncExternalStore: moving the card between slots moves it in the DOM,
// and a docked card hides in place, keeping its element and its space.

export type CardSlot =
  | { readonly hotspotId: string; readonly where: 'floating' }
  | { readonly hotspotId: string; readonly where: 'docked'; readonly shown: boolean }

// What the presenter reads from the page.
export type CardPageReads = {
  readonly layout: () => CardLayout
  // The chrome boxes over the stage, in stage pixels.
  readonly obstacles: () => readonly StageRect[]
}

const HIDDEN: OverlayPlacement = { kind: 'hidden' }

type PageState = {
  readonly layout: CardLayout
  readonly obstacles: readonly StageRect[]
  // The stage box the reads were made at.
  readonly box: OverlayBox | null
}

export class HotspotCardPresenter {
  private selected: string | null = null
  private cardSize: BoxSize | null = null
  private slot: CardSlot | null = null
  private page: PageState | null = null
  private readonly listeners = new Set<() => void>()
  // The placed markers of the decision being made, refilled per decision,
  // so a frame's decision allocates no list.
  private readonly placedMarkers: StagePoint[] = []

  constructor(
    private readonly overlay: StageOverlay,
    private readonly hotspotIds: readonly string[],
    private readonly reads: CardPageReads,
  ) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly snapshot = (): CardSlot | null => this.slot

  // The selection changed: the new card's size is unknown until it is
  // measured, and its element stays hidden until it is placed.
  show(hotspotId: string | null): void {
    if (hotspotId === this.selected) {
      return
    }
    this.selected = hotspotId
    this.cardSize = null
    this.overlay.place(CARD_OVERLAY_KEY, HIDDEN)
    if (hotspotId === null) {
      this.publish(null)
      return
    }
    this.readPage()
    this.present()
  }

  // The floating card laid out at a new size.
  measure(size: BoxSize): void {
    const current = this.cardSize
    if (current !== null && current.width === size.width && current.height === size.height) {
      return
    }
    this.cardSize = size
    this.readPage()
    this.present()
  }

  // The stage chrome changed size: its boxes are read again.
  chromeChanged(): void {
    if (this.selected === null) {
      return
    }
    this.readPage()
    this.present()
  }

  // Decides the open card's presentation from the overlay's last pass.
  present(): void {
    const selected = this.selected
    if (selected === null) {
      return
    }
    const page = this.pageAt(this.overlay.lastPassBox())
    this.placedMarkers.length = 0
    for (const id of this.hotspotIds) {
      const placement = this.overlay.placementOf(overlayKey(id))
      if (placement !== null && placement.kind === 'placed') {
        this.placedMarkers.push(placement)
      }
    }
    const marker = this.overlay.placementOf(overlayKey(selected))
    this.apply(
      selected,
      presentHotspotCard({
        policy: page.layout.policy,
        stage: this.overlay.lastPassBox(),
        marker: marker !== null && marker.kind === 'placed' ? marker : null,
        placedMarkers: this.placedMarkers,
        obstacles: page.obstacles,
        card: this.cardSize,
        metrics: page.layout.metrics,
        current: this.slot === null ? null : this.slot.where,
      }),
    )
  }

  // The page reads valid at the given stage box: kept while the box keeps
  // its size, read again when it changes.
  private pageAt(box: OverlayBox | null): PageState {
    const page = this.page
    if (page !== null && sameSize(page.box, box)) {
      return page
    }
    return this.readPage()
  }

  private readPage(): PageState {
    const page = {
      layout: this.reads.layout(),
      obstacles: this.reads.obstacles(),
      box: this.overlay.lastPassBox(),
    }
    this.page = page
    return page
  }

  // The floating element is placed before the slot is published, so a
  // card element that mounts on the new slot enters at its placement.
  private apply(hotspotId: string, presentation: CardPresentation): void {
    switch (presentation.slot) {
      case 'floating': {
        const { at } = presentation
        this.overlay.place(
          CARD_OVERLAY_KEY,
          at === null ? HIDDEN : { kind: 'placed', x: at.box.left, y: at.box.top },
        )
        this.publishIfChanged({ hotspotId, where: 'floating' })
        return
      }
      case 'docked':
        this.overlay.place(CARD_OVERLAY_KEY, HIDDEN)
        this.publishIfChanged({ hotspotId, where: 'docked', shown: presentation.shown })
        return
    }
  }

  private publishIfChanged(next: CardSlot): void {
    if (this.slot !== null && sameSlot(this.slot, next)) {
      return
    }
    this.publish(next)
  }

  private publish(slot: CardSlot | null): void {
    this.slot = slot
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function sameSlot(a: CardSlot, b: CardSlot): boolean {
  if (a.hotspotId !== b.hotspotId) {
    return false
  }
  if (a.where === 'floating' || b.where === 'floating') {
    return a.where === b.where
  }
  return a.shown === b.shown
}

function sameSize(a: OverlayBox | null, b: OverlayBox | null): boolean {
  if (a === null || b === null) {
    return a === b
  }
  return a.width === b.width && a.height === b.height
}
