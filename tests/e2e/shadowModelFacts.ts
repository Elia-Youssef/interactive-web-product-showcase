import { fileURLToPath } from 'node:url'
import { modelPathOf } from '../../scripts/fixtureProducts.ts'
import { SHADOW_NODE_NAME } from '../../src/lib/product/contractNames.ts'
import { memoizedRead, readSharedModelDocument } from './sharedProductModels'

// The repo root: the parent of the tests folder this file lives in.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The committed model's shadow facts, read in Node from the .glb the site
// ships, without the viewer in the loop. The authored opacity is the base
// color factor's alpha of the SHADOW mesh's material, which is the value the
// glTF loader maps onto the material's opacity
// (node_modules/three/examples/jsm/loaders/GLTFLoader.js:830), so a runtime
// opacity can be held to the authored one exactly. A material factor is a
// float in the file by glTF definition, never quantized, so the read is the
// loader's own value.

// The authored opacity per slug, read once per process.
const opacityBySlug = new Map<string, Promise<number>>()

export function readShadowAuthoredOpacity(slug: string): Promise<number> {
  return memoizedRead(opacityBySlug, slug, async () => {
    const doc = await readSharedModelDocument(await modelPathOf(ROOT, slug))

    const shadowNode = doc
      .getRoot()
      .listNodes()
      .find((node) => node.getName() === SHADOW_NODE_NAME)
    if (shadowNode === undefined) {
      throw new Error(`the ${slug} model has no ${SHADOW_NODE_NAME} node to read its opacity from`)
    }
    const mesh = shadowNode.getMesh()
    if (mesh === null) {
      throw new Error(`the ${SHADOW_NODE_NAME} node of the ${slug} model carries no mesh`)
    }

    const primitives = mesh.listPrimitives()
    if (primitives.length !== 1) {
      throw new Error(
        `the ${SHADOW_NODE_NAME} mesh of the ${slug} model carries ${primitives.length} primitives, expected one`,
      )
    }
    const material = primitives[0]?.getMaterial() ?? null
    if (material === null) {
      throw new Error(`the ${SHADOW_NODE_NAME} primitive of the ${slug} model has no material`)
    }
    if (material.getAlphaMode() !== 'BLEND') {
      throw new Error(`the shadow material of the ${slug} model is not alpha blended`)
    }

    const alpha = material.getBaseColorFactor()[3]
    if (alpha === undefined) {
      throw new Error(`the base color factor of ${material.getName()} carries no alpha`)
    }
    return Math.fround(alpha)
  })
}
