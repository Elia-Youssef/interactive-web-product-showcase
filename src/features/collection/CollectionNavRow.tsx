import { useState } from 'react'
import type { Product, ProductCollection } from '@lib/product'
import { formatProductCounter, stepLabel } from '@lib/product'
import { formatProductPath } from '@lib/routing'
import { siteCopy } from '@lib/copy/site'
import { ChevronLeftIcon, ChevronRightIcon, IconLink, Readout, useFocusReturn } from '@ui/index'
import type { LinkComponent } from '@ui/index'
import { CollectionIndexDialog } from './CollectionIndexDialog'
import styles from './CollectionNavRow.module.css'

export type CollectionNavRowProps = {
  // The product the row navigates from.
  readonly product: Product
  // The collection the row moves through: the neighbors, the counter and
  // the index all read it.
  readonly collection: ProductCollection
  // The app's link, handed down from the composition: the row renders the
  // in-app addresses through it.
  readonly link: LinkComponent
}

// The collection navigation row of the panel: the previous and next links
// around the counter, and the index overlay the counter opens. Everything
// comes from the collection and the current slug, so a product that ships
// is navigable without a change here.
export function CollectionNavRow({ product, collection, link }: CollectionNavRowProps) {
  const [indexOpen, setIndexOpen] = useState(false)
  // The counter hands the shared hook itself before opening the dialog.
  // Capture focuses the counter, so the native dialog records its opener;
  // the same hook returns focus when the platform leaves it lost.
  const captureTrigger = useFocusReturn(indexOpen)

  const neighbors = collection.neighbors(product.slug)
  if (neighbors === undefined) {
    throw new Error(`the collection holds no product '${product.slug}' to navigate from`)
  }

  return (
    <>
      <nav className={styles.row} aria-label={siteCopy.indexLabel}>
        <IconLink
          link={link}
          to={formatProductPath(neighbors.previous.slug)}
          aria-label={stepLabel(siteCopy.previousLabel, neighbors.previous)}
        >
          <ChevronLeftIcon />
        </IconLink>
        <button
          type="button"
          className={styles.counter}
          aria-label={siteCopy.openIndexLabel}
          aria-haspopup="dialog"
          aria-expanded={indexOpen}
          onClick={(event) => {
            captureTrigger(event.currentTarget)
            setIndexOpen(true)
          }}
        >
          <Readout>{formatProductCounter(product.number, collection.products.length)}</Readout>
        </button>
        <IconLink
          link={link}
          to={formatProductPath(neighbors.next.slug)}
          aria-label={stepLabel(siteCopy.nextLabel, neighbors.next)}
        >
          <ChevronRightIcon />
        </IconLink>
      </nav>
      <CollectionIndexDialog
        open={indexOpen}
        onClose={() => setIndexOpen(false)}
        products={collection.products}
        currentSlug={product.slug}
        link={link}
      />
    </>
  )
}
