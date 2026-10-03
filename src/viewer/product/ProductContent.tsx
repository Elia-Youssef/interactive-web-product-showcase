import { use, useCallback, useMemo, type ReactNode } from 'react'
import { productModelUrl, type Product } from '@lib/product'
import { useAppStore } from '@store/index'
import { measureModelFrame } from '../modelFrame'
import { ProductLook } from '../look/ProductLook'
import { parseProductRig } from '../rig/parseProductRig'
import { summarizeProductRig } from '../rig/summary'
import { useStageHold } from '../stageHoldsContext'
import { disposeProductScene } from './dispose'
import { useProductModelLoads } from './ProductModelsProvider'
import { LoadedProductContext, type LoadedProduct } from './loadedProduct'
import { readFinishMaterials } from './finishMaterials'
import { useProductPresentation } from './useProductPresentation'

type ProductContentProps = {
  readonly manifest: Product
  // The product's extensions, mounted once the product is loaded.
  readonly children?: ReactNode
}

// The loaded product inside the Canvas: it loads the model through the
// stage's own model loads, parses the rig, measures the frame once, renders the
// scene centered on the origin, and hands the stage life (the home
// presentation, the settle, the ready report) to the presentation hook. Its
// extensions mount with it and read the loaded product from context.
// Suspends while the model loads, so it mounts only under the Suspense
// boundary its Product provides; a load failure, a contract-breaking model
// or a settle failure propagates to the product boundary.
export function ProductContent({ manifest, children }: ProductContentProps) {
  const slug = manifest.slug
  const url = productModelUrl(slug)
  const models = useProductModelLoads()
  const productReady = useAppStore((state) => state.productReady)

  // The load entry is the same object on every render while it is live, so
  // the suspension resumes on the very promise it suspended on.
  const model = models.read(url)
  const gltf = use(model.value)

  // The parse is part of the render: a model that breaks the contract fails
  // here, once, with every problem listed, and the boundary reports it.
  const rig = useMemo(
    () =>
      parseProductRig(
        { scene: gltf.scene, animations: gltf.animations, json: gltf.parser.json },
        manifest,
      ),
    [gltf, manifest],
  )
  const summary = useMemo(() => summarizeProductRig(rig), [rig])
  // The finish materials the load resolved with the model. Reading them is
  // part of the render: a load that somehow skipped the resolver fails here,
  // once, instead of leaving a switch to hit a half-loaded model.
  const finishes = useMemo(() => readFinishMaterials(gltf.userData), [gltf.userData])
  const loaded = useMemo<LoadedProduct>(
    () => ({ manifest, scene: gltf.scene, rig, parser: gltf.parser, finishes }),
    [manifest, gltf, rig, finishes],
  )
  // The frame is measured once per load: it centers the scene, feeds the
  // home presentation, and its counts ride with the ready status.
  const frame = useMemo(() => measureModelFrame(gltf.scene), [gltf.scene])

  const report = useCallback(() => {
    productReady(slug, summary, { meshes: frame.meshes, triangles: frame.triangles })
  }, [productReady, slug, summary, frame])

  const failure = useProductPresentation({ rig, manifest, frame, report })

  // The loaded product's lifetime is this component's hold on it. Once the
  // hold is gone for good, the scene is disposed with every finish material
  // the load resolved, and the load is forgotten, so the next mount loads
  // fresh instead of reusing a released tree.
  const releaseScene = useCallback(() => {
    disposeProductScene(gltf.scene, finishes)
    models.forget(model)
  }, [gltf.scene, finishes, models, model])
  useStageHold(gltf.scene, releaseScene)

  // A failure is thrown to the boundary that owns the product's failures,
  // never reported as a presented product and never only logged. The throw
  // sits after every hook, so the component's hook order never changes.
  if (failure !== null) {
    throw failure
  }

  // The offset centers the model on the origin, where the camera looks. The
  // extensions sit beside it, in stage space, and reach the scene's own
  // nodes through the loaded product.
  return (
    <>
      <group position={[-frame.centerX, -frame.centerY, -frame.centerZ]}>
        <primitive object={gltf.scene} />
      </group>
      <LoadedProductContext.Provider value={loaded}>
        <ProductLook />
        {children}
      </LoadedProductContext.Provider>
    </>
  )
}
