// The dev-only panel harness: top bar with the product index label, then
// the panel column with the ProductPanel content. ?manifests=invalid swaps
// the real manifest list for a broken fixture, so the typed error screen is
// reachable without touching the app.

import type { ProductCollection } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { productManifests } from '@products/index'
import { AppStoreProvider } from '@store/index'
import { CollectionProvider } from '@app/collection/CollectionProvider'
import { ProductIndexLabel, ProductPanel } from '@features/product-panel'
import { Eyebrow } from '@ui/index'
import { invalidManifests } from './invalidManifests'
import styles from './PanelHarness.module.css'

const INVALID_MANIFESTS_PARAM = 'manifests'
const INVALID_MANIFESTS_VALUE = 'invalid'

function harnessManifests(): readonly unknown[] {
  const params = new URLSearchParams(window.location.search)
  return params.get(INVALID_MANIFESTS_PARAM) === INVALID_MANIFESTS_VALUE
    ? invalidManifests
    : productManifests
}

function ReadyHarness({ collection }: { collection: ProductCollection }) {
  const product = collection.first

  return (
    <>
      <header className={styles.topBar}>
        <Eyebrow>{siteCopy.studioName}</Eyebrow>
        <ProductIndexLabel number={product.number} category={product.category} />
      </header>
      <div className={styles.content}>
        <div className={styles.panel}>
          <ProductPanel product={product} />
        </div>
      </div>
    </>
  )
}

export function PanelHarness() {
  return (
    <main className={styles.page}>
      <AppStoreProvider>
        <CollectionProvider manifests={harnessManifests()}>
          {(collection) => <ReadyHarness collection={collection} />}
        </CollectionProvider>
      </AppStoreProvider>
    </main>
  )
}
