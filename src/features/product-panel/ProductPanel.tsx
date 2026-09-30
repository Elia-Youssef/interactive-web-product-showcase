// The panel content, top to bottom: the
// current product's words, all from its manifest, then the finish list. The
// product arrives as a prop; the selected finish is the only state, and it
// lives in the store's finish slice, which this component reads and writes
// exclusively. Layout owns the panel container and its hairline; this is
// the content inside it.

import { useLayoutEffect } from 'react'
import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { selectSelectedVariant, useAppStore } from '@store/index'
import { Divider, Eyebrow, Readout, Swatch, Title } from '@ui/index'
import { activeFinish } from './product-panel.logic'
import styles from './ProductPanel.module.css'

export type ProductPanelProps = {
  product: Product
}

export function ProductPanel({ product }: ProductPanelProps) {
  const finishOffered = useAppStore((state) => state.finishOffered)
  const finishSelected = useAppStore((state) => state.finishSelected)
  const selectedVariant = useAppStore((state) => selectSelectedVariant(state, product.slug))

  // The store must know the current product's finishes to select within
  // them, so the panel offers them under the product's slug, in a layout
  // effect, so the painted first frame already shows the default finish as
  // active. The offer names the product, so the first render of a switched
  // product still reads its own default, never the last product's choice.
  useLayoutEffect(() => {
    finishOffered(
      product.slug,
      product.finishes.map((finish) => finish.variant),
    )
  }, [finishOffered, product])

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
          <Eyebrow>{siteCopy.finishHeading}</Eyebrow>
          <span className={styles.activeFinish} data-active-finish>
            <Readout>{active.label}</Readout>
          </span>
        </div>
        <div className={styles.swatches} role="group" aria-label={siteCopy.finishHeading}>
          {product.finishes.map((finish) => (
            <Swatch
              key={finish.variant}
              color={finish.swatch}
              label={finish.label}
              selected={finish.variant === active.variant}
              onClick={() => finishSelected(product.slug, finish.variant)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
