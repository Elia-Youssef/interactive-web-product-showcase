import type { ProductTransitionProps } from '@lib/transition'
import { ProductTransition } from './productTransition'
import styles from './ProductSwitchLayer.module.css'

type ProductSwitchLayerProps = ProductTransitionProps & {
  // The slug of the product the stage shows: the switch's shown life.
  readonly shown: string
}

// The layer over the whole stage the switch transition draws in: above the
// canvas, the hotspot overlay and the stage's alerts. It takes no pointer
// events of its own, so the stage stays usable under it while nothing is
// drawn; a transition that blocks input while it covers says so on its own
// elements. The layer names the running phase and the product the stage
// shows, the switch's own words for where the sequence stands, written in
// the same commit as the stage's swap.
export function ProductSwitchLayer({ shown, ...transition }: ProductSwitchLayerProps) {
  return (
    <div
      className={styles.layer}
      data-product-transition={transition.phase}
      data-product-shown={shown}
    >
      <ProductTransition {...transition} />
    </div>
  )
}
