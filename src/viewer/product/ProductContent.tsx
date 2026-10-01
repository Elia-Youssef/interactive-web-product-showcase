import { useCallback, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { productModelUrl, type Product } from '@lib/product'
import { useAppStore } from '@store/index'
import { parseProductRig } from '../rig/parseProductRig'
import { summarizeProductRig } from '../rig/summary'
import { useStageHold } from '../stageHoldsContext'
import { disposeProductScene } from './dispose'
import { useProductKtx2Loader } from './DecoderProvider'
import { wireProductDecoders, type GltfLoaderLike } from './decoders'

type ProductContentProps = {
  readonly manifest: Product
}

// The loaded product inside the Canvas: it loads the model through the
// stage's own decoders, parses the rig, reports the ready status with the
// rig summary once, renders the scene, and holds the scene through the
// stage until its mount ends. Suspends while the model loads, so it mounts
// only under the Suspense boundary its Product provides; a load failure or
// a contract-breaking model propagates to the product boundary.
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

  useEffect(() => {
    productReady(slug, summary)
  }, [slug, summary, productReady])

  // The loaded product's lifetime is this component's hold on it. Once the
  // hold is gone for good, the scene is disposed and its suspense cache entry
  // cleared, so the next mount loads fresh instead of reusing a released
  // tree.
  const releaseScene = useCallback(() => {
    disposeProductScene(gltf.scene)
    useGLTF.clear(url)
  }, [gltf.scene, url])
  useStageHold(gltf.scene, releaseScene)

  return <primitive object={gltf.scene} />
}
