import type { StageRect } from '@lib/hotspots/markerBox'

export type CardHost = 'floating' | 'docked' | 'listed'
export type CardIntent = {
  readonly selected: string
  readonly slot: CardHost
  readonly shown?: boolean
  readonly ready?: boolean
}
export type CardGeometry = {
  readonly mounted: boolean
  readonly shown: boolean
  readonly bounds: StageRect
}
export type CommittedCardRead = CardGeometry & {
  readonly selected: string
  readonly slot: CardHost
  readonly commit: number
}

// A ref registers the host React actually committed, not the presenter's
// intended slot. Geometry is read from that host at observation time.
// Native commits acknowledge against the last presented scene geometry;
// a scene pass still commits every presenter before its observers read.
export class CommittedCard {
  private intent: CardIntent | null = null
  private intentRevision = 0
  private presentedIntent = -1
  private presentedCommit = -1
  private layout = 0
  private presentedLayout = -1
  private current: { selected: string; slot: CardHost; read: () => CardGeometry } | null = null
  private revision = 0

  intend(intent: CardIntent | null): void {
    const previous = this.intent
    if (
      previous === null || intent === null
        ? previous === intent
        : previous.selected === intent.selected &&
          previous.slot === intent.slot &&
          previous.shown === intent.shown &&
          previous.ready === intent.ready
    )
      return
    this.intent = intent === null ? null : { ...intent }
    this.intentRevision += 1
  }

  present(): void {
    this.presentedIntent = this.intentRevision
    this.presentedCommit = this.revision
    this.presentedLayout = this.layout
  }

  geometryChanged(): void {
    this.layout += 1
  }

  get idle(): boolean {
    if (
      this.presentedIntent !== this.intentRevision ||
      this.presentedCommit !== this.revision ||
      this.presentedLayout !== this.layout
    )
      return false
    const current = this.read()
    if (this.intent === null) return current === null
    return (
      current !== null &&
      current.mounted &&
      current.selected === this.intent.selected &&
      current.slot === this.intent.slot &&
      this.intent.ready !== false &&
      (this.intent.shown === undefined || current.shown === this.intent.shown)
    )
  }

  mount(selected: string, slot: CardHost, read: () => CardGeometry): () => void {
    if (this.current !== null) throw new Error('a committed card host is already held')
    const current = { selected, slot, read }
    this.current = current
    this.revision += 1
    return () => {
      if (this.current !== current) throw new Error('the committed card host release is stale')
      this.current = null
      this.revision += 1
    }
  }

  read(): CommittedCardRead | null {
    const current = this.current
    return current === null
      ? null
      : { ...current.read(), selected: current.selected, slot: current.slot, commit: this.revision }
  }
}

export function readCardGeometry(element: HTMLElement): CardGeometry {
  const bounds = element.getBoundingClientRect()
  let shown = element.isConnected && bounds.width > 0 && bounds.height > 0
  for (
    let ancestor: HTMLElement | null = element;
    ancestor !== null;
    ancestor = ancestor.parentElement
  ) {
    const style = getComputedStyle(ancestor)
    if (style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0)
      shown = false
  }
  return {
    mounted: element.isConnected,
    shown,
    bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
  }
}
