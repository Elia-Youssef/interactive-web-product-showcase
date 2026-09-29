import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { productModelUrl, type Product } from '@lib/product'
import { useAppStore } from '@store/index'
import { parseProductRig } from '../rig/parseProductRig'
import { summarizeProductRig } from '../rig/summary'
import { disposeProductScene } from './dispose'
import { useProductKtx2Loader } from './DecoderProvider'
import { wireProductDecoders, type GltfLoaderLike } from './decoders'

type ProductContentProps = {
  readonly manifest: Product
}

// The loaded product inside the Canvas: it loads the model through the
// stage's own decoders, parses the rig, reports the ready status with the
// rig summary once, renders the scene, and disposes the scene completely
// when its mount ends. Suspends while the model loads, so it mounts only
// under the Suspense boundary its Product provides; a load failure or a
// contract-breaking model propagates to the product boundary.
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

  // The loaded product's lifetime ends with this mount: the scene is
  // disposed and the suspense cache entry is cleared, so the next mount
  // loads fresh instead of reusing the disposed tree. Two effects split the
  // two jobs: the disposal is keyed by the loaded object (it re-runs when
  // the object is replaced), while the cache clear runs once per mount.
  useEffect(() => {
    return () => {
      disposeProductScene(gltf.scene)
    }
  }, [gltf])

  // The state bump is the reload trigger for StrictMode's simulated
  // remount: React runs this cleanup once at mount and re-runs the setup
  // without re-rendering, which would leave the disposed scene committed.
  // The bump sends that remount back through a render, and the cleared
  // cache makes it load fresh. After a real unmount React drops the update.
  const [, scheduleReload] = useState(0)
  useEffect(() => {
    return () => {
      useGLTF.clear(url)
      scheduleReload((count) => count + 1)
    }
  }, [url])

  return <primitive object={gltf.scene} />
}
