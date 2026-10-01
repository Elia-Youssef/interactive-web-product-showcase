import styles from './ProductHarnessPage.module.css'

type HarnessProductControlsProps = {
  // Whether the product is mounted right now, so the mount toggle names the
  // action it offers, not the state it shows.
  readonly mounted: boolean
  readonly onToggleMounted: () => void
  readonly onMovePart: () => void
}

// The dev-only controls beside the mounted product: the mount toggle the
// disposal proof drives, and the part motion control the marker order
// contract is proven with. One press of the motion control mounts one fresh
// part motion, which moves for a few frames and stops. The controls share
// one corner slot, laid out as a row, so each keeps its own hit area.
export function HarnessProductControls({
  mounted,
  onToggleMounted,
  onMovePart,
}: HarnessProductControlsProps) {
  return (
    <div className={styles.controls}>
      <button type="button" data-testid="remount-product" onClick={onToggleMounted}>
        {mounted ? 'Unmount the product' : 'Mount the product'}
      </button>
      <button type="button" data-testid="move-part" onClick={onMovePart}>
        Move one part
      </button>
    </div>
  )
}
