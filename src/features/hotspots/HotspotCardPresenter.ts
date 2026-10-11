import type { CardIntent } from '@viewer/overlay/CommittedCard'
import type { BoxSize } from '@lib/hotspots/cardPlacement'
import type { CardDockPolicy, CardPresentation, FloatingCard } from '@lib/hotspots/cardPresentation'
import { presentHotspotCard } from '@lib/hotspots/cardPresentation'
import type { StagePoint, StageRect } from '@lib/hotspots/markerBox'
import type { HotspotOrigin } from '@lib/hotspots/flow'
import type { OverlayBox, OverlayPlacement, StageOverlay } from '@viewer/overlay/StageOverlay'
import type { CardLayout } from '@lib/hotspots/cardLayout'
import { CARD_OVERLAY_KEY, overlayKey } from '@lib/hotspots/hotspotKeys'

// The one owner of where the open hotspot card goes, for one product's
// markers on one stage. It decides through the pure presentation rule, from
// where the selection was opened, the stage overlay's last pass (the stage box, every marker's placement,
// and the projected extent of the selected hotspot's subject), the layout
// the stylesheets declare, the stage chrome boxes, and the floating card's
// measured size. It decides at the end of every overlay pass, after the
// frame's markers are written, and when the card's selection, its size or
// the chrome changes, which happens with no frame at all: opening a card
// renders nothing on the stage.
//
// The layout and the chrome boxes change only with the stage box (a
// breakpoint is crossed by resizing, and the chrome sits at the stage
// edges) or on their own resize, so they are read on a selection, a
// measure, a chrome change and a pass whose stage box changed size, and
// kept between: a pass of a moving camera reads no style.
//
// A floating card is the overlay element under the card key, placed by the
// top-left corner of the box the rule chose, so it rides the overlay's own
// writer, hidden included, with no React render. The card's slot (listed
// under its Highlights item, floating in the overlay or docked in the
// layout's dock) and a docked card's shown state are React state, published through subscribe and snapshot for
// useSyncExternalStore: moving the card between slots moves it in the DOM,
// and a docked card hides in place, keeping its element and its space.
//
// The decision scratch is the presenter's own: the input record the pass
// refills, the target the pure rules write into, and the reuse of the
// placed marker list. The slot and the card key's placement publish a
// fresh record only when they change, so a steady pass allocates nothing.

export type CardSlot =
  | { readonly hotspotId: string; readonly where: 'listed' }
  | { readonly hotspotId: string; readonly where: 'floating' }
  | { readonly hotspotId: string; readonly where: 'docked'; readonly shown: boolean }

// The open selection the presenter shows: its hotspot and where it was
// opened from.
export type CardSelection = {
  readonly hotspotId: string
  readonly origin: HotspotOrigin
}

// What the presenter reads from the page.
export type CardPageReads = {
  readonly layout: () => CardLayout
  // The chrome boxes over the stage, in stage pixels.
  readonly obstacles: () => readonly StageRect[]
}

// The mutable form of the presentation rule's input, refilled per decision.
type CardInputScratch = {
  origin: HotspotOrigin
  policy: CardDockPolicy
  stage: OverlayBox | null
  marker: StagePoint | null
  placedMarkers: StagePoint[]
  subject: StageRect | null
  obstacles: readonly StageRect[]
  card: BoxSize | null
  metrics: CardLayout['metrics']
  current: CardSlot['where'] | null
}

// The open selection with its own derived overlay key.
type SelectedCard = {
  readonly selection: CardSelection
  readonly key: string
}

const HIDDEN: OverlayPlacement = { kind: 'hidden' }

type PageState = {
  readonly layout: CardLayout
  readonly obstacles: readonly StageRect[]
  // The stage box the reads were made at.
  readonly box: OverlayBox | null
}

export class HotspotCardPresenter {
  private readonly desired: {
    selected: string
    slot: CardIntent['slot']
    ready: boolean
    shown: boolean
  } = { selected: '', slot: 'floating', ready: false, shown: false }
  private selected: SelectedCard | null = null
  private cardSize: BoxSize | null = null
  private slot: CardSlot | null = null
  private page: PageState | null = null
  private readonly listeners = new Set<() => void>()
  // The placed markers of the decision being made, refilled per decision,
  // so a frame's decision allocates no list.
  private readonly placedMarkers: StagePoint[] = []
  // Each hotspot's overlay key, derived once: a decision reads every key it
  // needs, and a key is a built string, not a per-frame one.
  private readonly keys: readonly string[]
  // The input the presentation rule reads and the decision it writes, both
  // refilled per decision.
  private readonly input: CardInputScratch = {
    origin: 'marker',
    policy: 'when-crowded',
    stage: null,
    marker: null,
    placedMarkers: this.placedMarkers,
    subject: null,
    obstacles: [],
    card: null,
    metrics: { markerHitPx: 0, cardOffsetPx: 0, focusOutsetPx: 0 },
    current: null,
  }
  // The floating presentation the rule returns when the card floats beside
  // its marker: the presenter's own record, its spot refilled per decision.
  private readonly floating: FloatingCard = {
    slot: 'floating',
    at: { side: 'right', left: 0, top: 0, right: 0, bottom: 0 },
  }

  constructor(
    private readonly overlay: StageOverlay,
    hotspotIds: readonly string[],
    private readonly reads: CardPageReads,
  ) {
    this.keys = hotspotIds.map(overlayKey)
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly snapshot = (): CardSlot | null => this.slot

  // The selection changed, its hotspot or its origin: the new card's size
  // is unknown until it is measured, and its element stays hidden until it
  // is placed.
  show(selection: CardSelection | null): void {
    const current = this.selected
    if (sameSelection(selection, current === null ? null : current.selection)) {
      return
    }
    this.selected = selection === null ? null : { selection, key: overlayKey(selection.hotspotId) }
    this.cardSize = null
    this.placeCardHidden()
    if (selection === null) {
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
    this.overlay.card.geometryChanged()
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
    const input = this.input
    input.origin = selected.selection.origin
    input.policy = page.layout.policy
    input.stage = this.overlay.lastPassBox()
    input.subject = this.overlay.boxOf(selected.key)
    input.obstacles = page.obstacles
    input.card = this.cardSize
    input.metrics = page.layout.metrics
    input.current = this.slot === null ? null : this.slot.where
    this.placedMarkers.length = 0
    for (const key of this.keys) {
      const placement = this.overlay.placementOf(key)
      if (placement !== null && placement.kind === 'placed') {
        this.placedMarkers.push(placement)
      }
    }
    const marker = this.overlay.placementOf(selected.key)
    input.marker = marker !== null && marker.kind === 'placed' ? marker : null
    this.apply(selected, presentHotspotCard(input, this.floating))
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
  // card element that mounts on the new slot enters at its placement. Each
  // case publishes its slot as a fresh record only when it differs from
  // the last published one.
  private apply(selected: SelectedCard, presentation: CardPresentation): void {
    const hotspotId = selected.selection.hotspotId
    this.desired.selected = hotspotId
    this.desired.slot = presentation.slot
    this.desired.ready = !this.waitsForMeasure(selected, presentation)
    switch (presentation.slot) {
      case 'listed': {
        this.desired.shown = true
        this.overlay.card.intend(this.desired)
        this.placeCardHidden()
        if (!this.slotSays(hotspotId, 'listed', false)) {
          this.publish({ hotspotId, where: 'listed' })
        }
        return
      }
      case 'floating': {
        const at = presentation.at
        this.desired.shown = at !== null
        this.overlay.card.intend(this.desired)
        if (at === null) {
          this.placeCardHidden()
        } else {
          this.placeCardAt(at.left, at.top)
        }
        if (!this.slotSays(hotspotId, 'floating', false)) {
          this.publish({ hotspotId, where: 'floating' })
        }
        return
      }
      case 'docked': {
        const { shown } = presentation
        this.desired.shown = shown
        this.overlay.card.intend(this.desired)
        this.placeCardHidden()
        if (!this.slotSays(hotspotId, 'docked', shown)) {
          this.publish({ hotspotId, where: 'docked', shown })
        }
        return
      }
    }
  }

  // Whether the card still waits for its first measure before it can be
  // placed: a floating card with no measure and a placed marker.
  private waitsForMeasure(selected: SelectedCard, presentation: CardPresentation): boolean {
    return (
      presentation.slot === 'floating' &&
      presentation.at === null &&
      this.cardSize === null &&
      this.overlay.placementOf(selected.key)?.kind === 'placed'
    )
  }

  // Whether the last published slot already says exactly this.
  private slotSays(hotspotId: string, where: CardSlot['where'], dockedShown: boolean): boolean {
    const current = this.slot
    if (current === null || current.hotspotId !== hotspotId || current.where !== where) {
      return false
    }
    if (current.where === 'docked') {
      return current.shown === dockedShown
    }
    return true
  }

  // The overlay is the one record of the card key's placement: hidden is
  // written only when the overlay does not already hold it.
  private placeCardHidden(): void {
    if (this.overlay.placementOf(CARD_OVERLAY_KEY) === HIDDEN) {
      return
    }
    this.overlay.place(CARD_OVERLAY_KEY, HIDDEN)
  }

  private placeCardAt(x: number, y: number): void {
    const last = this.overlay.placementOf(CARD_OVERLAY_KEY)
    if (last !== null && last.kind === 'placed' && last.x === x && last.y === y) {
      return
    }
    const placement: OverlayPlacement = { kind: 'placed', x, y }
    this.overlay.place(CARD_OVERLAY_KEY, placement)
  }

  private publish(slot: CardSlot | null): void {
    this.slot = slot
    if (slot === null) this.overlay.card.intend(null)
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function sameSelection(a: CardSelection | null, b: CardSelection | null): boolean {
  return a === null || b === null ? a === b : a.hotspotId === b.hotspotId && a.origin === b.origin
}

function sameSize(a: OverlayBox | null, b: OverlayBox | null): boolean {
  return a === null || b === null ? a === b : a.width === b.width && a.height === b.height
}
