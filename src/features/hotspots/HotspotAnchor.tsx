import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { Card, Marker } from '@ui/index'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import { overlayKey } from './hotspotKeys'
import styles from './HotspotMarkers.module.css'

export type HotspotAnchorProps = {
  // The overlay channel the anchor mounts itself on: the anchor is the
  // element the overlay places, so the marker and the open card both ride
  // the placement the canvas side writes for the hotspot's key.
  readonly overlay: StageOverlay
  readonly hotspot: Product['hotspots'][number]
  readonly selected: boolean
  readonly onToggle: () => void
  readonly onClose: () => void
}

// The anchor of one hotspot: the wrapper the stage overlay centers on the
// hotspot's projection, holding the marker and, while the hotspot is
// selected, its card. The overlay's hidden state is a visibility on the
// wrapper, so the card hides whenever the marker hides; nothing inside sets
// visibility, and the card is absolutely positioned, so it never changes
// the anchor's size and the marker stays centered on the projection.
export function HotspotAnchor({
  overlay,
  hotspot,
  selected,
  onToggle,
  onClose,
}: HotspotAnchorProps) {
  return (
    <div
      ref={(element) => {
        // React 19 takes a ref cleanup in place of the null call: the
        // release is the mount's own, so a stale one would fail loudly.
        if (element === null) {
          return undefined
        }
        return overlay.mount(overlayKey(hotspot.id), element)
      }}
      className={selected ? `${styles.anchor} ${styles.anchorSelected}` : styles.anchor}
    >
      <Marker label={hotspot.title} active={selected} onClick={onToggle} />
      {selected && (
        <div className={styles.cardAnchor} data-testid="hotspot-card">
          <Card
            eyebrow={hotspot.eyebrow}
            title={hotspot.title}
            bullets={hotspot.bullets}
            onClose={onClose}
            closeLabel={siteCopy.closeLabel}
          />
        </div>
      )}
    </div>
  )
}
