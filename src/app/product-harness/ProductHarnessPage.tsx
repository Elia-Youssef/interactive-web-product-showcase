import '@styles/global.css'
import { useMemo, useState } from 'react'
import {
  CollectionError,
  createCollection,
  type Product as ProductManifest,
  type ProductLookBlock,
} from '@lib/product'
import { productManifests } from '@products/index'
import { ProductFinishes, useFinishOffer } from '@features/variants'
import { AppStoreProvider, useAppStore } from '@store/index'
import { Stage } from '@viewer/Stage'
import { StageAlert } from '@viewer/StageAlert'
import { Product } from '@viewer/product/Product'
import styles from './ProductHarnessPage.module.css'
import { RendererMemoryProbe } from './RendererMemoryProbe'
import { SceneGraphProbe } from './SceneGraphProbe'
import { StageWarmup } from './StageWarmup'
import { harnessLook } from './harnessLook'
import { harnessSlug } from './harnessSlug'

type HarnessContentProps = {
  readonly slug: string | null
  // The look block the look parameter parsed into, or null when the product
  // keeps its manifest's own block.
  readonly lookOverride: ProductLookBlock | null
}

// The dev-only page the product e2e drives: one store around one stage
// whose content is the product named by the slug query parameter, plus the
// memory probe the disposal spec reads. A button unmounts and remounts the
// product under the same stage, so the disposal proof measures the real
// teardown against this page's own baseline. The manifests reach the page
// through the derived index and the collection's own validation, never a
// hand copy. The look query parameter, dev-only like the page itself,
// overrides the product's own look block for this page at the data level:
// the page hands Product a manifest whose look block is the parsed one, so
// the product path reads one look source, its manifest. An invalid
// parameter shows the harness alert. The production build never emits this
// page: its only input is index.html.
export function ProductHarnessPage() {
  return (
    <AppStoreProvider>
      <main className={styles.frame}>
        <HarnessStage />
      </main>
    </AppStoreProvider>
  )
}

function HarnessStage() {
  const slug = harnessSlug(window.location.search)
  const look = harnessLook(window.location.search)
  const harness = useMemo(() => {
    try {
      return { kind: 'ready', collection: createCollection(productManifests) } as const
    } catch (error) {
      if (error instanceof CollectionError) {
        return { kind: 'invalid', reason: error.message } as const
      }
      throw error
    }
  }, [])

  if (harness.kind === 'invalid') {
    return (
      <>
        <Stage />
        <StageAlert testid="harness-alert" reason={harness.reason} />
      </>
    )
  }
  if (look.kind === 'invalid') {
    return (
      <>
        <Stage />
        <StageAlert testid="harness-alert" reason={look.reason} />
      </>
    )
  }
  return (
    <HarnessProduct
      slug={slug}
      collection={harness.collection}
      lookOverride={look.kind === 'override' ? look.look : null}
    />
  )
}

function HarnessProduct({
  slug,
  collection,
  lookOverride,
}: HarnessContentProps & HarnessCollection) {
  const [mounted, setMounted] = useState(true)
  const manifest = slug === null ? undefined : collection.bySlug(slug)
  // The override rides on the manifest, so the product path sees one look
  // source and no test plumbing. The memo keeps the manifest's identity
  // stable across renders, like the collection's own manifests are.
  const pageManifest = useMemo<ProductManifest | undefined>(() => {
    if (manifest === undefined) {
      return undefined
    }
    return lookOverride === null ? manifest : { ...manifest, look: lookOverride }
  }, [manifest, lookOverride])

  const content = (
    <>
      <RendererMemoryProbe />
      <StageWarmup />
      {pageManifest !== undefined && mounted && (
        <Product manifest={pageManifest}>
          <SceneGraphProbe />
          <ProductFinishes />
        </Product>
      )}
    </>
  )

  return (
    <>
      <Stage content={content} />
      {slug === null && (
        <StageAlert
          testid="harness-alert"
          reason="The product harness needs a slug parameter naming a product."
        />
      )}
      {slug !== null && manifest === undefined && (
        <StageAlert
          testid="harness-alert"
          reason={`No product '${slug}': the collection holds ${collection.products
            .map((product) => product.slug)
            .join(', ')}.`}
        />
      )}
      {manifest !== undefined && (
        <>
          <HarnessFinishControls manifest={manifest} />
          <button
            type="button"
            className={styles.toggle}
            data-testid="remount-product"
            onClick={() => setMounted((current) => !current)}
          >
            {mounted ? 'Unmount the product' : 'Mount the product'}
          </button>
        </>
      )}
    </>
  )
}

// The dev-only finish controls the product e2e drives: one button per
// manifest finish, selecting through the store's finish slice, and the one
// offer hook that puts the manifest's finishes in the store. The offer sits
// here so a selection lands even while the product is unmounted, and the
// remount presents the store's selection, never a default.
function HarnessFinishControls({ manifest }: { readonly manifest: ProductManifest }) {
  const finishSelected = useAppStore((state) => state.finishSelected)

  useFinishOffer(manifest)

  return (
    <div className={styles.finishes} data-testid="harness-finishes">
      {manifest.finishes.map((finish) => (
        <button
          key={finish.variant}
          type="button"
          data-testid={`harness-finish-${finish.variant}`}
          onClick={() => finishSelected(manifest.slug, finish.variant)}
        >
          {finish.label}
        </button>
      ))}
    </div>
  )
}

type HarnessCollection = {
  readonly collection: ReturnType<typeof createCollection>
}
