import { useCallback, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { productModelUrl, type Product } from '@lib/product'
import { useAppStore } from '@store/index'
import { measureModelFrame } from '../modelFrame'
import { parseProductRig } from '../rig/parseProductRig'
import { summarizeProductRig } from '../rig/summary'
import { useStageHold } from '../stageHoldsContext'
import { disposeProductScene } from './dispose'
import { useProductKtx2Loader } from './DecoderProvider'
import { wireProductDecoders, type GltfLoaderLike } from './decoders'
import { useProductPresentation } from './useProductPresentation'

type ProductContentProps = {
  readonly manifest: Product
}

// The loaded product inside the Canvas: it loads the model through the
// stage's own decoders, parses the rig, measures the frame once, renders the
// scene centered on the origin, and hands the stage life (fit, settle,
// ready report) to the presentation hook. Suspends while the model loads,
// so it mounts only under the Suspense boundary its Product provides; a load
// failure, a contract-breaking model or a settle failure propagates to the
// product boundary.
export function ProductContent({ manifest }: ProductContentProps) {
  const slug = manifest.slug
  const url = productModelUrl(slug)
  const ktx2 = useProductKtx2Loader()
  const productReady = useAppStore((state) => state.productReady)

  const extendLoader = useCallback(
    (loader: GltfLoaderLike) => wireProductDecoders(loader, ktx2),
    [ktx2],
  )

  // Drei's own draco and meshopt paths stay off (false, false): the extend
  // callback below is the whole decoding setup, and none of it is a CDN.
  const gltf = useGLTF(url, false, false, extendLoader)

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
  // The frame is measured once per load: it centers the scene, feeds the
  // camera fit, and its counts ride with the ready status.
  const frame = useMemo(() => measureModelFrame(gltf.scene), [gltf.scene])

  const report = useCallback(() => {
    productReady(slug, summary, { meshes: frame.meshes, triangles: frame.triangles })
  }, [productReady, slug, summary, frame])

  const failure = useProductPresentation({ frame, report })

  // The loaded product's lifetime is this component's hold on it. Once the
  // hold is gone for good, the scene is disposed and its suspense cache entry
  // cleared, so the next mount loads fresh instead of reusing a released
  // tree.
  const releaseScene = useCallback(() => {
    disposeProductScene(gltf.scene)
    useGLTF.clear(url)
  }, [gltf.scene, url])
  useStageHold(gltf.scene, releaseScene)

  // A failure is thrown to the boundary that owns the product's failures,
  // never reported as a presented product and never only logged. The throw
  // sits after every hook, so the component's hook order never changes.
  if (failure !== null) {
    throw failure
  }

  // The offset centers the model on the origin, where the camera looks.
  return (
    <group position={[-frame.centerX, -frame.centerY, -frame.centerZ]}>
      <primitive object={gltf.scene} />
    </group>
  )
}
