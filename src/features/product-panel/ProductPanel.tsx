// The panel content, top to bottom: the
// current product's words, all from its manifest, then the finish list. The
// product arrives as a prop; the selected finish is the only state, and it
// lives in the store's finish slice, which this component reads and writes
// exclusively. The offer of the product's finishes is the variants
// feature's one offer hook; layout owns the panel container and its
// hairline, and this is the content inside it.

import type { ReactNode } from 'react'
import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { selectSelectedVariant, useAppStore } from '@store/index'
import { useFinishOffer } from '@features/variants'
import { Divider, Eyebrow, Readout, SwatchGroup, Title } from '@ui/index'
import { ProductExplodeScrub } from './ProductExplodeScrub'
import { ProductExplodeToggle } from './ProductExplodeToggle'
import { activeFinish } from '@lib/copy/productPanel'
import styles from './ProductPanel.module.css'

export type ProductPanelProps = {
  product: Product
  // The navigation row slot, after the explode controls: the composition
  // decides what a product page navigates with, so the panel never
  // reaches another feature for it.
  navigationRow?: ReactNode
}

export function ProductPanel({ product, navigationRow }: ProductPanelProps) {
  const finishSelected = useAppStore((state) => state.finishSelected)
  const selectedVariant = useAppStore((state) => selectSelectedVariant(state, product.slug))

  useFinishOffer(product)

  const active = activeFinish(product, selectedVariant)

  return (
    <div className={styles.panel}>
      <Eyebrow>{product.eyebrow}</Eyebrow>
      <Title brand={product.brand} model={product.model} />
      <p className={styles.tagline}>{product.tagline}</p>
      <div className={styles.intro}>
        {product.intro.map((line, index) => (
          <p key={index} className={styles.introLine}>
            {line}
          </p>
        ))}
      </div>
      <div className={styles.rule}>
        <Divider />
      </div>
      <div className={styles.finish}>
        <div className={styles.finishHeading}>
          <Eyebrow level={2}>{siteCopy.finishHeading}</Eyebrow>
          <span className={styles.activeFinish} data-active-finish>
            <Readout>{active.label}</Readout>
          </span>
        </div>
        <SwatchGroup
          label={siteCopy.finishHeading}
          items={product.finishes.map((finish) => ({
            key: finish.variant,
            color: finish.swatch,
            label: finish.label,
            checked: finish.variant === active.variant,
          }))}
          onSelect={(variant) => finishSelected(product.slug, variant)}
        />
      </div>
      <ProductExplodeToggle product={product} />
      <ProductExplodeScrub product={product} />
      {navigationRow}
    </div>
  )
}
