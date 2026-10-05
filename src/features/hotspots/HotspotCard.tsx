import { useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { Card } from '@ui/index'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import type { CardSlot, HotspotCardPresenter } from './HotspotCardPresenter'
import { CARD_OVERLAY_KEY } from '@lib/hotspots/hotspotKeys'
import styles from './HotspotCard.module.css'

export type HotspotCardProps = {
  readonly hotspot: Product['hotspots'][number]
  readonly slot: CardSlot
  readonly overlay: StageOverlay
  readonly presenter: HotspotCardPresenter
  // The layout's dock the card renders into when it docks. The composition
  // that mounts the markers owns it, beside the stage.
  readonly dock: HTMLElement | null
  readonly onClose: () => void
}

// The open hotspot card in the slot its presenter chose: floating on the
// stage overlay, or docked in the layout's dock. Both are the same card with
// the same close button; the flow's Escape and camera rules do not see
// which one shows.
export function HotspotCard({
  hotspot,
  slot,
  overlay,
  presenter,
  dock,
  onClose,
}: HotspotCardProps) {
  const card = (
    <Card
      eyebrow={hotspot.eyebrow}
      title={hotspot.title}
      bullets={hotspot.bullets}
      onClose={onClose}
      closeLabel={siteCopy.closeLabel}
    />
  )
  switch (slot.where) {
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
      return createPortal(
        <div
          ref={bringIntoView}
          className={slot.shown ? styles.docked : `${styles.docked} ${styles.dockedHidden}`}
          data-testid="hotspot-card"
        >
          {card}
        </div>,
        dock,
      )
  }
}

// A docked card brings itself into its dock's scrollport as it mounts, which
// is when it docks or, keyed by its hotspot, when the open hotspot changes
// while docked: the dock sits in a scrolling panel, and a visitor may have
// scrolled it anywhere. The scroll follows the panel's own scroll behavior,
// which the stylesheet makes smooth only when reduced motion is off.
function bringIntoView(element: HTMLDivElement | null): void {
  element?.scrollIntoView({ block: 'nearest' })
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
