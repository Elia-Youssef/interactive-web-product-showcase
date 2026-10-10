import { useCallback, useId, useState } from 'react'
import type { Product } from '@lib/product'
import { highlightsLabel } from '@lib/copy/productPanel'
import { Disclosure, useFocusReturn } from '@ui/index'
import type { ListedCardHost } from './HotspotCard'
import { useHotspotFlow } from './useHotspotFlow'
import styles from './HighlightsList.module.css'

export type HighlightsListProps = {
  readonly product: Product
  // Hands the composition the host of the item whose hotspot is open from
  // the list, or null when none is, so the markers render the card there.
  readonly onListHost: (host: ListedCardHost | null) => void
}

// The panel's Highlights section: a disclosure named with the hotspot
// count, listing one button per manifest hotspot in manifest order, so every
// hotspot is reachable whatever the camera shows; a marker the view hides
// leaves the tab order, its list item never does. A product with no
// hotspots shows no section. The items wait disabled until the product is
// presented. An item opens its hotspot through the same flow a marker
// does, with the list as the origin, so the close-up, Escape and Reset
// behave as they do for a marker; the card then renders under the item by
// portal, into the host the open item holds. The item's focus return puts
// focus back on it however its card closes. Closing the section closes a
// card open from it, since the card would have nowhere to show.
export function HighlightsList({ product, onListHost }: HighlightsListProps) {
  const flow = useHotspotFlow(product)
  const [expanded, setExpanded] = useState(false)
  const listOpen = flow.selected !== null && flow.origin === 'list'
  const captureTrigger = useFocusReturn(listOpen)

  return (
    <HighlightsSection
      product={product}
      expanded={expanded}
      presented={flow.presented}
      open={listOpen ? flow.selected : null}
      onToggle={() => {
        if (expanded && listOpen) {
          flow.close()
        }
        setExpanded(!expanded)
      }}
      onPress={(hotspotId, trigger) => {
        captureTrigger(trigger)
        flow.press(hotspotId, 'list')
      }}
      onListHost={onListHost}
    />
  )
}

export type HighlightsSectionProps = {
  readonly product: Product
  readonly expanded: boolean
  // Whether the product is presented: the items wait disabled until it is.
  readonly presented: boolean
  // The hotspot open from the list, or null.
  readonly open: string | null
  readonly onToggle: () => void
  readonly onPress: (hotspotId: string, trigger: HTMLButtonElement) => void
  readonly onListHost: (host: ListedCardHost | null) => void
}

// The section alone, from plain values: the store-bound list feeds it, and
// a static render can reach every state through it.
export function HighlightsSection({
  product,
  expanded,
  presented,
  open,
  onToggle,
  onPress,
  onListHost,
}: HighlightsSectionProps) {
  const hostIdBase = useId()
  if (product.hotspots.length === 0) {
    return null
  }
  return (
    <Disclosure
      className={styles.highlights}
      label={highlightsLabel(product.hotspots.length)}
      expanded={expanded}
      onToggle={onToggle}
    >
      <ul className={styles.list} role="list">
        {product.hotspots.map((hotspot) => {
          const itemOpen = open === hotspot.id
          const hostId = `${hostIdBase}${hotspot.id}`
          return (
            <li key={hotspot.id} className={styles.item}>
              <button
                type="button"
                className={styles.button}
                aria-expanded={itemOpen}
                aria-controls={itemOpen ? hostId : undefined}
                disabled={!presented}
                onClick={(event) => onPress(hotspot.id, event.currentTarget)}
              >
                {hotspot.title}
              </button>
              {itemOpen && (
                <ListedHost id={hostId} hotspotId={hotspot.id} onListHost={onListHost} />
              )}
            </li>
          )
        })}
      </ul>
    </Disclosure>
  )
}

// The host an open list item holds for its card: registered with the
// composition while it is mounted, keyed by its hotspot, so a card renders
// only into the host of its own item.
function ListedHost({
  id,
  hotspotId,
  onListHost,
}: {
  readonly id: string
  readonly hotspotId: string
  readonly onListHost: (host: ListedCardHost | null) => void
}) {
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      // React 19 takes a ref cleanup in place of the null call.
      if (element === null) {
        return undefined
      }
      onListHost({ hotspotId, element })
      return () => onListHost(null)
    },
    [hotspotId, onListHost],
  )
  return <div ref={attach} id={id} className={styles.host} />
}
