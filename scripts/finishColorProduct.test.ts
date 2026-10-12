import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  KHRMaterialsUnlit,
  KHRMaterialsVariants,
  type MappingList,
} from '@gltf-transform/extensions'
import { MeshoptEncoder } from 'meshoptimizer'
import type { Document } from '@gltf-transform/core'
import { beforeAll, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { fixtureModelPathOf } from './fixtureProducts.ts'
import { createModelIO } from './modelIo.ts'
import { finishColorProduct } from './finishColorProduct.fixtures.ts'

let doc: Document
let rebuiltBytes: Buffer
let servedBytes: Buffer
beforeAll(async () => {
  const file = fixtureModelPathOf(path.resolve(import.meta.dirname, '..'), 'finish-colors')
  const io = await createModelIO()
  doc = await io.read(file)
  await MeshoptEncoder.ready
  const built = await finishColorProduct()
  built.io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  rebuiltBytes = Buffer.from(await built.io.writeBinary(built.doc))
  servedBytes = await readFile(file)
}, TOOL_FIXTURE_TIMEOUT_MS)

it('the served color fixture carries reproducible unlit red and gray mappings', () => {
  const variants = doc.createExtension(KHRMaterialsVariants).listVariants()
  expect(variants.map((variant) => variant.getName())).toEqual(['red', 'gray'])
  let changedSurfaces = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const list = primitive.getExtension<MappingList>('KHR_materials_variants')
      if (list === null) continue
      const materials = variants.map((variant) =>
        list
          .listMappings()
          .find((mapping) => mapping.listVariants().includes(variant))
          ?.getMaterial(),
      )
      if (materials[0] === materials[1]) continue
      changedSurfaces += 1
      for (const [index, material] of materials.entries()) {
        expect(material).not.toBeNull()
        expect(material?.getExtension(KHRMaterialsUnlit.EXTENSION_NAME)).not.toBeNull()
        expect(material?.getBaseColorTexture()).toBeNull()
        expect(material?.getOcclusionTexture()).toBeNull()
        const color = material?.getBaseColorFactor()
        if (index === 0) {
          expect(color).toEqual([1, 0, 0, 1])
        } else {
          expect(color?.slice(0, 3)).toEqual([color?.[0], color?.[0], color?.[0]])
          // Independently stated sRGB midpoint in linear glTF channels.
          expect(color?.[0]).toBeCloseTo(0.21586050011389926, 14)
        }
      }
    }
  }
  expect(changedSurfaces).toBe(2)
  // Deep Buffer equality took 1742 ms alone; native comparison still checks every byte.
  expect(rebuiltBytes.equals(servedBytes)).toBe(true)
})
