import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AnimationClip, Object3D } from 'three'
import { parseProduct } from '@lib/product'
import { plannedFinish } from '@lib/product/finishPlan.fixtures'
import { sampleOneManifest } from '@lib/product/fixtures'
import type { ProductFinishMaterials } from './finishMaterials'
import { LoadedProductContext, useLoadedProduct, type LoadedProduct } from './loadedProduct'

function SlugOfLoadedProduct() {
  return <>{useLoadedProduct().manifest.slug}</>
}

// A load whose file declares no finishes resolves an empty finish table and
// records nothing on the scene.
const noFinishes: ProductFinishMaterials = {
  plan: plannedFinish({}),
  materials: new Map(),
  rawMaterials: new Map(),
  sceneMaterials: new Set(),
}

function loadedSample(): LoadedProduct {
  return {
    manifest: parseProduct(sampleOneManifest, 'fixture'),
    scene: new Object3D(),
    rig: {
      parts: new Map(),
      hotspots: [],
      cameras: new Map(),
      shadow: new Object3D(),
      clip: new AnimationClip('Explode', 1, []),
      variants: [],
      anchorRest: new Map(),
      explodedBounds: null,
    },
    parser: {
      json: {},
      associations: new Map(),
      getDependency: () => Promise.resolve(null),
    },
    finishes: noFinishes,
  }
}

test('an extension inside a loaded product reads that product', () => {
  const loaded = loadedSample()

  const html = renderToString(
    <LoadedProductContext.Provider value={loaded}>
      <SlugOfLoadedProduct />
    </LoadedProductContext.Provider>,
  )

  expect(html).toBe(loaded.manifest.slug)
})

test('an extension outside a loaded product fails loudly', () => {
  expect(() => renderToString(<SlugOfLoadedProduct />)).toThrow(
    'a product extension renders outside a loaded product',
  )
})
