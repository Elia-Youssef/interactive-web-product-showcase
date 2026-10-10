import { useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { Card } from '@ui/index'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import type { CardSlot, HotspotCardPresenter } from './HotspotCardPresenter'
import { CARD_OVERLAY_KEY } from '@lib/hotspots/hotspotKeys'
import { bringCardIntoView } from './bringCardIntoView'
import styles from './HotspotCard.module.css'

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
  const card = (
    <Card
      eyebrow={hotspot.eyebrow}
      title={hotspot.title}
      bullets={hotspot.bullets}
      onClose={onClose}
      closeLabel={siteCopy.closeLabel}
      headingLevel={slot.where === 'listed' ? 3 : 2}
    />
  )
  switch (slot.where) {
    case 'listed':
      // The item's host mounts in the commit that lists the card, so the
      // render that first lists it may run before the host is there; the
      // card renders into the host of its own hotspot only.
      if (listHost === null || listHost.hotspotId !== hotspot.id) {
        return null
      }
      return <PanelCard host={listHost.element} className={styles.listed} card={card} />
    case 'floating':
      return (
        <FloatingCard overlay={overlay} presenter={presenter}>
          {card}
        </FloatingCard>
      )
    case 'docked':
      if (dock === null) {
        throw new Error('the hotspot card docked, but its composition gave the markers no dock')
      }
      return (
        <PanelCard
          host={dock}
          className={slot.shown ? styles.docked : `${styles.docked} ${styles.dockedHidden}`}
          card={card}
        />
      )
  }
}

// A card in the panel, docked or listed: rendered into its host by portal,
// brought into view as it mounts.
function PanelCard({
  host,
  className,
  card,
}: {
  readonly host: HTMLElement
  readonly className: string | undefined
  readonly card: ReactNode
}) {
  return createPortal(
    <div ref={bringCardIntoView} className={className} data-testid="hotspot-card">
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
}: {
  readonly overlay: StageOverlay
  readonly presenter: HotspotCardPresenter
  readonly children: ReactNode
}) {
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      // React 19 takes a ref cleanup in place of the null call.
      if (element === null) {
        return undefined
      }
      const release = overlay.mount(CARD_OVERLAY_KEY, element, 'top-left')
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const size = entry.borderBoxSize[0]
          if (size === undefined) {
            throw new Error('the floating card was observed with no border box size')
          }
          presenter.measure({ width: size.inlineSize, height: size.blockSize })
        }
      })
      observer.observe(element)
      return () => {
        observer.disconnect()
        release()
      }
    },
    [overlay, presenter],
  )
  return (
    <div ref={attach} className={styles.floating} data-testid="hotspot-card">
      {children}
    </div>
  )
}
