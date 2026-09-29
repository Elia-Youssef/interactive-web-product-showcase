// The product index label of the top bar: the
// collection position and the category as one readout, '01 / Audio'. The
// number is formatted by the feature logic, the category arrives from the
// manifest in normal case and the CSS uppercases it, so screen readers read
// words instead of spelled-out letters.

import { formatProductIndex } from './product-panel.logic'
import styles from './ProductIndexLabel.module.css'

export type ProductIndexLabelProps = {
  number: number
  category: string
}

export function ProductIndexLabel({ number, category }: ProductIndexLabelProps) {
  return (
    <span className={styles.label}>
      {formatProductIndex(number)} / {category}
    </span>
  )
}
