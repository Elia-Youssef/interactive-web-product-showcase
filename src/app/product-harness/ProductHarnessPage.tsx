import '@styles/global.css'
import { useMemo, useState } from 'react'
import { CollectionError, createCollection, type Product as ProductManifest } from '@lib/product'
import { productManifests } from '@products/index'
import { useFinishOffer } from '@features/variants'
import { AppStoreProvider, useAppStore } from '@store/index'
import { Stage } from '@viewer/Stage'
import { StageAlert } from '@viewer/StageAlert'
import styles from './ProductHarnessPage.module.css'
import { HarnessProductContent } from './HarnessProductContent'
import { harnessOverrides, withOverrides, type HarnessOverrides } from './harnessOverrides'
import { harnessSlug } from './harnessSlug'

// The dev-only page the product e2e drives: one store around one stage
// whose content is the product named by the slug query parameter. The
// manifests reach the page through the derived index and the collection's
// own validation, never a hand copy. The look and camera query parameters,
// dev-only like the page itself, override the product's own blocks for this
// page at the data level. An invalid parameter shows the harness alert.
// The production build never emits this page: its only input is index.html.
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
  // Parsed once per page: the overrides keep their identity across renders,
  // so the manifest built from them does too.
  const overrides = useMemo(() => harnessOverrides(window.location.search), [])
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
  if (overrides.kind === 'invalid') {
    return (
      <>
        <Stage />
        <StageAlert testid="harness-alert" reason={overrides.reason} />
      </>
    )
  }
  return (
    <HarnessProduct slug={slug} collection={harness.collection} overrides={overrides.overrides} />
  )
}

type HarnessCollection = {
  readonly collection: ReturnType<typeof createCollection>
}

// The product side of the harness: the overridden manifest, the mount
// toggle, the finish controls, and the alerts the slug state can raise.
function HarnessProduct({
  slug,
  collection,
  overrides,
}: {
  readonly slug: string | null
  readonly collection: HarnessCollection['collection']
  readonly overrides: HarnessOverrides
}) {
  const [mounted, setMounted] = useState(true)
  const manifest = slug === null ? undefined : collection.bySlug(slug)
  // The overrides ride on the manifest, so the product path sees one source
  // per block and no test plumbing. The memo keeps the manifest's identity
  // stable across renders, like the collection's own manifests are.
  const pageManifest = useMemo(() => withOverrides(manifest, overrides), [manifest, overrides])
  const content = <HarnessProductContent manifest={pageManifest} mounted={mounted} />

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
