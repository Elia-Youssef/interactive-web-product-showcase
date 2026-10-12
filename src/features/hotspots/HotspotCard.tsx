import { useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '@lib/product'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import type { CardSlot, HotspotCardPresenter } from './HotspotCardPresenter'
import { CARD_OVERLAY_KEY } from '@lib/hotspots/hotspotKeys'
import styles from './HotspotCard.module.css'
import { useCommittedCard } from './useCommittedCard'
import { HotspotCardContent } from './HotspotCardContent'

// The element a Highlights list item holds for its own card, while that
// item's hotspot is the one open from the list: the hotspot it belongs to
// and the element itself.
export type ListedCardHost = {
  readonly hotspotId: string
  readonly element: HTMLElement
}

export type HotspotCardProps = {
  readonly hotspot: Product['hotspots'][number]
  readonly slot: CardSlot
  readonly overlay: StageOverlay
  readonly presenter: HotspotCardPresenter
  // The layout's dock the card renders into when it docks. The composition
  // that mounts the markers owns it, beside the stage.
  readonly dock: HTMLElement | null
  // The Highlights list item's host the card renders into when it is
  // listed, or null while no list item holds one.
  readonly listHost: ListedCardHost | null
  readonly onClose: () => void
}

// The open hotspot card in the slot its presenter chose: listed under its
// Highlights item, floating on the stage overlay, or docked in the layout's
// dock. All are the same card with the same close button; the flow's
// Escape and camera rules do not see which one shows. A listed card sits
// under the section heading of its list, so its title is an h3.
export function HotspotCard({
  hotspot,
  slot,
  overlay,
  presenter,
  dock,
  listHost,
  onClose,
}: HotspotCardProps) {
  const committed = useCommittedCard(overlay, hotspot.id, slot.where)
  const card = (
    <HotspotCardContent hotspot={hotspot} listed={slot.where === 'listed'} onClose={onClose} />
  )
  switch (slot.where) {
    case 'listed':
      // The item's host mounts in the commit that lists the card, so the
      // render that first lists it may run before the host is there; the
      // card renders into the host of its own hotspot only.
      if (listHost === null || listHost.hotspotId !== hotspot.id) {
        return null
      }
      return (
        <PanelCard
          host={listHost.element}
          className={styles.listed}
          card={card}
          committed={committed}
        />
      )
    case 'floating':
      return (
        <FloatingCard overlay={overlay} presenter={presenter} committed={committed}>
          {card}
        </FloatingCard>
      )
    case 'docked':
      if (dock === null) {
        throw new Error('the hotspot card docked, but its composition gave the markers no dock')
      }
      return <PanelCard host={dock} className={styles.docked} card={card} committed={committed} />
  }
}

// A card in the panel, docked or listed: rendered into its host by portal,
// brought into view as it mounts.
function PanelCard({
  host,
  className,
  card,
  committed,
}: {
  readonly host: HTMLElement
  readonly className: string | undefined
  readonly card: ReactNode
  readonly committed: (element: HTMLDivElement | null) => (() => void) | undefined
}) {
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      const release = committed(element)
      return release
    },
    [committed],
  )
  return createPortal(
    <div ref={attach} className={className} data-testid="hotspot-card">
      {card}
    </div>,
    host,
  )
}

// The floating card's element: mounted on the stage overlay under the card
// key by its top-left corner, so the overlay puts the card's edges exactly
// where the presenter computed them, and observed for its laid-out size,
// which the presenter places it by.
function FloatingCard({
  overlay,
  presenter,
  children,
  committed,
}: {
  readonly overlay: StageOverlay
  readonly presenter: HotspotCardPresenter
  readonly children: ReactNode
  readonly committed: (element: HTMLDivElement | null) => (() => void) | undefined
}) {
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      // React 19 takes a ref cleanup in place of the null call.
      if (element === null) {
        return undefined
      }
      const release = overlay.mount(CARD_OVERLAY_KEY, element, 'top-left')
      const releaseCommit = committed(element)
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const size = entry.borderBoxSize[0]
          if (size === undefined) {
            throw new Error('the floating card was observed with no border box size')
          }
          presenter.measure({ width: size.inlineSize, height: size.blockSize })
          overlay.card.present()
        }
      })
      observer.observe(element)
      return () => {
        observer.disconnect()
        release()
        releaseCommit?.()
      }
    },
    [overlay, presenter, committed],
  )
  return (
    <div ref={attach} className={styles.floating} data-testid="hotspot-card">
      {children}
    </div>
  )
}
