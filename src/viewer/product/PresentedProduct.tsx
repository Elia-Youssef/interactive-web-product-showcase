import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Product, ProductFailure, ProductModelCounts, ProductRigSummary } from '@lib/product'
import { measureModelFrame } from '../modelFrame'
import { ProductLook } from '../look/ProductLook'
import { ShadowOpacityContext } from '../look/shadowOpacityContext'
import { createShadowOpacityHolder } from '../look/shadowOpacityOwner'
import type { ProductRig } from '../rig/productRig'
import { summarizeProductRig } from '../rig/summary'
import { LoadedProductContext, type LoadedProduct } from './loadedProduct'
import { createProductReadyGate, ProductReadyGateContext } from './productReadyGate'
import type { ProductFinishMaterials } from './finishMaterials'
import type { LoadedModel } from './productModelLoads'
import { useProductPresentation } from './useProductPresentation'
import { useStageFrameFailures } from '../stageFrameContext'

type PresentedProductProps = {
  readonly manifest: Product
  // The opened model, the rig parsed from it and the finish materials the
  // load resolved.
  readonly model: LoadedModel
  readonly rig: ProductRig
  readonly finishes: ProductFinishMaterials
  // The product's failure channel, for the failures of the presentation.
  readonly fail: (failure: ProductFailure) => void
  // The product's ready report, with the rig summary and the model counts.
  readonly ready: (rig: ProductRigSummary, model: ProductModelCounts) => void
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
  ready,
  children,
}: PresentedProductProps) {
  // The shadow opacity's per-product slot, one per presented product like
  // the loaded product itself: the look installs its owner into it and the
  // features that fade the shadow claim their factor through it.
  const [shadowOpacity] = useState(createShadowOpacityHolder)
  // The ready gate, one per presented product: the extensions hold their
  // first work on it and the presentation's ready settle waits for it.
  const [readyGate] = useState(createProductReadyGate)

  const summary = useMemo(() => summarizeProductRig(rig), [rig])
  const loaded = useMemo<LoadedProduct>(
    () => ({ manifest, scene: model.scene, rig, parser: model.parser, finishes }),
    [manifest, model, rig, finishes],
  )
  // The frame is measured once per load: it centers the scene, feeds the
  // home presentation, and its counts ride with the ready status.
  const frame = useMemo(() => measureModelFrame(model.scene), [model.scene])

  const report = useCallback(() => {
    ready(summary, { meshes: frame.meshes, triangles: frame.triangles })
  }, [ready, summary, frame])

  useProductPresentation({ rig, manifest, frame, report, fail, readyGate })

  // The presented content owns the stage's frames while it is in the scene:
  // a frame that throws then fails the product with the render kind. The
  // ownership starts in the commit that puts the scene on the stage and
  // ends in the one that takes it off, so a frame that fails while the
  // product only loads is the stage's, never the product's.
  const failRender = useCallback(
    (error: Error) => fail({ kind: 'render', message: error.message }),
    [fail],
  )
  useStageFrameFailures('content', failRender)

  // The offset centers the model on the origin, where the camera looks. The
  // extensions sit beside it, in stage space, and reach the scene's own
  // nodes through the loaded product.
  return (
    <>
      <group position={[-frame.centerX, -frame.centerY, -frame.centerZ]}>
        <primitive object={model.scene} />
      </group>
      <LoadedProductContext.Provider value={loaded}>
        <ShadowOpacityContext.Provider value={shadowOpacity}>
          <ProductReadyGateContext.Provider value={readyGate}>
            <ProductLook />
            {children}
          </ProductReadyGateContext.Provider>
        </ShadowOpacityContext.Provider>
      </LoadedProductContext.Provider>
    </>
  )
}
