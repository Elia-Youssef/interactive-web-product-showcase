import type { Product } from '@lib/product'
import { formatProductIndex, productName } from '@lib/product'
import { formatProductPath } from '@lib/routing'
import { Readout } from '@ui/index'
import type { LinkComponent } from '@ui/index'
import styles from './CollectionIndexDialog.module.css'

export type CollectionIndexEntriesProps = {
  readonly products: readonly Product[]
  readonly currentSlug: string
  // The app's link, handed down from the dialog: the entries navigate
  // through it.
  readonly link: LinkComponent
  // The click on an entry: the dialog's close, so choosing a product
  // closes the index with it.
  readonly onChoose: () => void
}

// The list of the index: one entry per product, in collection order, each
// showing the position, the name and the category from its manifest. The
// open product's entry carries the current page marker.
export function CollectionIndexEntries({
  products,
  currentSlug,
  link: Link,
  onChoose,
}: CollectionIndexEntriesProps) {
  return (
    <ul className={styles.list}>
      {products.map((product) => (
        <li key={product.slug}>
          <Link
            to={formatProductPath(product.slug)}
            className={styles.row}
            aria-current={product.slug === currentSlug ? 'page' : undefined}
            onClick={onChoose}
          >
            <Readout>{formatProductIndex(product.number)}</Readout>
            <span className={styles.name}>{productName(product)}</span>
            <span className={styles.category}>{product.category}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
