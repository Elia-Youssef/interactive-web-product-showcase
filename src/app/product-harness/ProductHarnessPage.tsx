import '@styles/global.css'
import { useCallback, useMemo, useState } from 'react'
import { CollectionError, createCollection, type Product as ProductManifest } from '@lib/product'
import { productManifests } from '@products/index'
import { ProductExplodeScrub, ProductExplodeToggle } from '@features/product-panel'
import { useFinishOffer } from '@features/variants'
import { AppStoreProvider, useAppStore } from '@store/index'
import { Stage } from '@viewer/Stage'
import { StageAlert } from '@viewer/StageAlert'
import { createStageSurface } from '@viewer/stageSurface'
import { StageSurfaceContext, useStageSurfaceElement } from '@viewer/stageSurfaceContext'
import styles from './ProductHarnessPage.module.css'
import { HarnessProductContent } from './HarnessProductContent'
import { harnessFrameFault, type HarnessFrameFault } from './frameFaultQuery'
import { harnessOverrides, withOverrides, type HarnessOverrides } from './harnessOverrides'
import { harnessSlug } from './harnessSlug'

// The dev-only page the product e2e drives: one store around one stage
// whose content is the product named by the slug query parameter. The
// manifests reach the page through the derived index and the collection's
// own validation, never a hand copy. The look and camera query parameters,
// dev-only like the page itself, override the product's own blocks for this
// page at the data level, and the frameFault parameter mounts a fault that
// throws inside the product's presented frames. An invalid parameter shows
// the harness alert.
// The production build never emits this page: its only input is index.html.
export function ProductHarnessPage() {
  // The stage surface, bound to the frame element that hosts the stage, so
  // the exploded view's grid reaction has its element on this page too.
  const [surface] = useState(createStageSurface)
  const bindSurface = useStageSurfaceElement(surface)

  return (
    <AppStoreProvider>
      <StageSurfaceContext.Provider value={surface}>
        <main className={styles.frame} ref={bindSurface}>
          <HarnessStage />
        </main>
      </StageSurfaceContext.Provider>
    </AppStoreProvider>
  )
}

function HarnessStage() {
  const slug = harnessSlug(window.location.search)
  // Parsed once per page: the overrides keep their identity across renders,
  // so the manifest built from them does too.
  const overrides = useMemo(() => harnessOverrides(window.location.search), [])
  const frameFault = harnessFrameFault(window.location.search)
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
    return <HarnessAlertStage reason={harness.reason} />
  }
  if (overrides.kind === 'invalid') {
    return <HarnessAlertStage reason={overrides.reason} />
  }
  if (frameFault.kind === 'invalid') {
    return <HarnessAlertStage reason={frameFault.reason} />
  }
  return (
    <HarnessProduct
      slug={slug}
      collection={harness.collection}
      overrides={overrides.overrides}
      frameFault={frameFault.kind === 'fault' ? frameFault.fault : null}
    />
  )
}

// The page when a parameter or the collection is invalid: an empty stage
// and the harness alert naming the problem.
function HarnessAlertStage({ reason }: { readonly reason: string }) {
  return (
    <>
      <Stage />
      <StageAlert testid="harness-alert" reason={reason} />
    </>
  )
}

type HarnessCollection = {
  readonly collection: ReturnType<typeof createCollection>
}

// The product side of the harness: the overridden manifest, the mount
// toggle, the product controls (the finishes, then the explode toggle and
// its scrub), and the alerts the slug state can raise. Every dev control
// laid over the stage carries the harness control mark, the one name the
// suite's stage captures mask the harness's controls by.
function HarnessProduct({
  slug,
  collection,
  overrides,
  frameFault,
}: {
  readonly slug: string | null
  readonly collection: HarnessCollection['collection']
  readonly overrides: HarnessOverrides
  readonly frameFault: HarnessFrameFault | null
}) {
  const { mounted, firstMount, toggle } = useHarnessMount()
  const manifest = slug === null ? undefined : collection.bySlug(slug)
  // The overrides ride on the manifest, so the product path sees one source
  // per block and no test plumbing. The memo keeps the manifest's identity
  // stable across renders, like the collection's own manifests are.
  const pageManifest = useMemo(() => withOverrides(manifest, overrides), [manifest, overrides])
  const content = (
    <HarnessProductContent
      manifest={pageManifest}
      mounted={mounted}
      frameFault={firstMount ? frameFault : null}
    />
  )

  return (
    <>
      <Stage content={content} />
      <HarnessSlugAlert slug={slug} found={manifest !== undefined} collection={collection} />
      {manifest !== undefined && (
        <>
          <div className={styles.controls} data-harness-control>
            <HarnessFinishControls manifest={manifest} />
            <ProductExplodeToggle product={manifest} />
            <ProductExplodeScrub product={manifest} />
          </div>
          <button
            type="button"
            className={styles.toggle}
            data-testid="remount-product"
            data-harness-control
            onClick={toggle}
          >
            {mounted ? 'Unmount the product' : 'Mount the product'}
          </button>
        </>
      )}
    </>
  )
}

// The alert the slug parameter can raise: no slug, or a slug the collection
// does not hold.
function HarnessSlugAlert({
  slug,
  found,
  collection,
}: {
  readonly slug: string | null
  readonly found: boolean
  readonly collection: HarnessCollection['collection']
}) {
  if (slug === null) {
    return (
      <StageAlert
        testid="harness-alert"
        reason="The product harness needs a slug parameter naming a product."
      />
    )
  }
  if (found) {
    return null
  }
  return (
    <StageAlert
      testid="harness-alert"
      reason={`No product '${slug}': the collection holds ${collection.products
        .map((product) => product.slug)
        .join(', ')}.`}
    />
  )
}

// The harness's product mount: whether the product is mounted, and whether
// this is still the page's first mount. The frame fault rides the first
// mount only: the toggle's remount is new, clean content, which is what the
// recovery proofs mount.
function useHarnessMount(): {
  readonly mounted: boolean
  readonly firstMount: boolean
  readonly toggle: () => void
} {
  const [mounted, setMounted] = useState(true)
  const [firstMount, setFirstMount] = useState(true)
  const toggle = useCallback(() => {
    setMounted((current) => !current)
    setFirstMount(false)
  }, [])
  return { mounted, firstMount, toggle }
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
    <div className={styles.finishes}>
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
