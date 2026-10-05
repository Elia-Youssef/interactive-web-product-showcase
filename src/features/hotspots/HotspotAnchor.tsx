import type { Product } from '@lib/product'
import { Marker } from '@ui/index'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import { overlayKey } from '@lib/hotspots/hotspotKeys'
import styles from './HotspotMarkers.module.css'

export type HotspotAnchorProps = {
  // The overlay channel the anchor mounts itself on: the anchor is the
  // element the overlay places, so the marker rides the placement the
  // canvas side writes for the hotspot's key.
  readonly overlay: StageOverlay
  readonly hotspot: Product['hotspots'][number]
  readonly selected: boolean
  readonly onToggle: () => void
}

// The anchor of one hotspot: the wrapper the stage overlay centers on the
// hotspot's projection, holding the marker. The overlay's hidden state is a
// visibility on the wrapper; nothing inside sets visibility. The open card
// is not inside the anchor: it has a presenter of its own, which places it
// beside the marker or docks it.
export function HotspotAnchor({ overlay, hotspot, selected, onToggle }: HotspotAnchorProps) {
  return (
    <div
      ref={(element) => {
        // React 19 takes a ref cleanup in place of the null call: the
        // release is the mount's own, so a stale one would fail loudly.
        if (element === null) {
          return undefined
        }
        return overlay.mount(overlayKey(hotspot.id), element, 'center')
      }}
      className={styles.anchor}
    >
      <Marker label={hotspot.title} active={selected} onClick={onToggle} />
    </div>
  )
}
