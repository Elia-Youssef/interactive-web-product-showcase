// The exploded view's scrub control, the panel section under the toggle:
// the slider carries the store's target and dispatches the scrub event, the
// mono readout shows the published applied progress, and the slider's value
// text is the readout's own string, so assistive tech and the readout say
// the same thing. Its name is the scrub name of the copy module, the
// toggle's word plus what the slider changes, so the two controls of the
// section never share one name. It is disabled while the product has no
// attached view, exactly like the toggle.

import type { Product } from '@lib/product'
import {
  selectExplodeAttached,
  selectExplodeReadout,
  selectExplodeTarget,
  useAppStore,
} from '@store/index'
import { Readout, Slider } from '@ui/index'
import { explodeScrubStep } from './config'
import styles from './ProductExplodeScrub.module.css'
import { explodeScrubName, formatExplodePercent } from '@lib/copy/productPanel'

export function ProductExplodeScrub({ product }: { product: Product }) {
  const explodeScrub = useAppStore((state) => state.explodeScrub)
  const attached = useAppStore((state) => selectExplodeAttached(state, product.slug))
  const target = useAppStore((state) => selectExplodeTarget(state, product.slug))
  const progress = useAppStore((state) => selectExplodeReadout(state, product.slug))

  const label = explodeScrubName(product)
  // Nothing published is the assembled rest: the same fall-back the selector
  // makes for another product's readout, formatted by the one function.
  const percent = formatExplodePercent(progress ?? 0)

  return (
    <div className={styles.scrub}>
      <Slider
        aria-label={label}
        value={target}
        valueText={percent}
        step={explodeScrubStep}
        disabled={!attached}
        onChange={(value) => explodeScrub(product.slug, value)}
      />
      <span className={styles.readoutCell} data-explode-readout>
        <Readout>{percent}</Readout>
      </span>
    </div>
  )
}
