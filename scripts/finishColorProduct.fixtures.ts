import path from 'node:path'
import { KHRMaterialsUnlit, KHRMaterialsVariants } from '@gltf-transform/extensions'
import { createModelIO } from './modelIo.ts'
import { fixtureModelPathOf } from './fixtureProducts.ts'

// Retain the camera, rig and geometry of the existing fixture; replace its
// changing materials with texture-free unlit colors. The binary is written
// from this builder, and its material facts are checked independently.
export async function finishColorProduct() {
  const root = path.resolve(import.meta.dirname, '..')
  const io = await createModelIO()
  const doc = await io.read(fixtureModelPathOf(root, 'placeholder-speaker'))
  const variants = doc.createExtension(KHRMaterialsVariants).listVariants()
  variants[0]?.setName('red')
  variants[1]?.setName('gray')
  const unlit = doc.createExtension(KHRMaterialsUnlit)
  // glTF stores linear color; this is the sRGB midpoint converted exactly.
  const gray = ((128 / 255 + 0.055) / 1.055) ** 2.4
  for (const material of doc.getRoot().listMaterials()) {
    const name = material.getName()
    if (!name.endsWith('_sage') && !name.endsWith('_graphite')) {
      continue
    }
    const red = name.endsWith('_sage')
    material
      .setName(name.replace(/_(sage|graphite)$/, red ? '_red' : '_gray'))
      .setBaseColorFactor(red ? [1, 0, 0, 1] : [gray, gray, gray, 1])
      .setBaseColorTexture(null)
      .setNormalTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null)
      .setEmissiveFactor([0, 0, 0])
      .setExtension(KHRMaterialsUnlit.EXTENSION_NAME, unlit.createUnlit())
  }
  return { io, doc }
}
