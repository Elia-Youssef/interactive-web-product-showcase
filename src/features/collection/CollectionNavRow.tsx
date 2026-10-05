import { useRef, useState } from 'react'
import type { Product, ProductCollection } from '@lib/product'
import { formatProductCounter, stepLabel } from '@lib/product'
import { formatProductPath } from '@lib/routing'
import { siteCopy } from '@lib/copy/site'
import { ChevronLeftIcon, ChevronRightIcon, IconLink, Readout } from '@ui/index'
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
  const counterRef = useRef<HTMLButtonElement>(null)

  const neighbors = collection.neighbors(product.slug)
  if (neighbors === undefined) {
    throw new Error(`the collection holds no product '${product.slug}' to navigate from`)
  }

  // The platform returns focus to the trigger when a modal dialog closes,
  // but only from the focus it moved in: an engine that leaves a pressed
  // button unfocused has nothing to return to. The counter is the one way
  // back into the flow, so the row returns focus itself.
  const closeIndex = () => {
    setIndexOpen(false)
    counterRef.current?.focus()
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
          ref={counterRef}
          type="button"
          className={styles.counter}
          aria-label={siteCopy.openIndexLabel}
          aria-haspopup="dialog"
          aria-expanded={indexOpen}
          onClick={() => setIndexOpen(true)}
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
        onClose={closeIndex}
        products={collection.products}
        currentSlug={product.slug}
        link={link}
      />
    </>
  )
}
