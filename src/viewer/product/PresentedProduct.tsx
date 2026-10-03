import { useCallback, useMemo, type ReactNode } from 'react'
import type { Product, ProductFailure } from '@lib/product'
import { useAppStore } from '@store/index'
import { measureModelFrame } from '../modelFrame'
import { ProductLook } from '../look/ProductLook'
import type { ProductRig } from '../rig/productRig'
import { summarizeProductRig } from '../rig/summary'
import { LoadedProductContext, type LoadedProduct } from './loadedProduct'
import type { ProductFinishMaterials } from './finishMaterials'
import type { LoadedModel } from './productModelLoads'
import { useProductPresentation } from './useProductPresentation'

type PresentedProductProps = {
  readonly manifest: Product
  // The opened model, the rig parsed from it and the finish materials the
  // load resolved.
  readonly model: LoadedModel
  readonly rig: ProductRig
  readonly finishes: ProductFinishMaterials
  // The product's failure channel, for the failures of the presentation.
  readonly fail: (failure: ProductFailure) => void
  // The product's extensions, mounted with the presented product.
  readonly children?: ReactNode
}

// The presented product inside the Canvas: it measures the frame once,
// renders the scene centered on the origin, and hands the stage life (the
// home presentation, the settle, the ready report) to the presentation
// hook, whose anticipated failures reach the product's channel as typed
// values. Its extensions mount with it and read the loaded product from
// context.
export function PresentedProduct({
  manifest,
  model,
  rig,
  finishes,
  fail,
  children,
}: PresentedProductProps) {
  const slug = manifest.slug
  const productReady = useAppStore((state) => state.productReady)

  const summary = useMemo(() => summarizeProductRig(rig), [rig])
  const loaded = useMemo<LoadedProduct>(
    () => ({ manifest, scene: model.scene, rig, parser: model.parser, finishes }),
    [manifest, model, rig, finishes],
  )
  // The frame is measured once per load: it centers the scene, feeds the
  // home presentation, and its counts ride with the ready status.
  const frame = useMemo(() => measureModelFrame(model.scene), [model.scene])

  const report = useCallback(() => {
    productReady(slug, summary, { meshes: frame.meshes, triangles: frame.triangles })
  }, [productReady, slug, summary, frame])

  useProductPresentation({ rig, manifest, frame, report, fail })

  // The offset centers the model on the origin, where the camera looks. The
  // extensions sit beside it, in stage space, and reach the scene's own
  // nodes through the loaded product.
  return (
    <>
      <group position={[-frame.centerX, -frame.centerY, -frame.centerZ]}>
        <primitive object={model.scene} />
      </group>
      <LoadedProductContext.Provider value={loaded}>
        <ProductLook />
        {children}
      </LoadedProductContext.Provider>
    </>
  )
}
