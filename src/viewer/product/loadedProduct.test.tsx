import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AnimationClip, Object3D } from 'three'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import { LoadedProductContext, useLoadedProduct, type LoadedProduct } from './loadedProduct'

function SlugOfLoadedProduct() {
  return <>{useLoadedProduct().manifest.slug}</>
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
    },
    parser: {
      json: {},
      associations: new Map(),
      getDependency: () => Promise.resolve(null),
    },
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
