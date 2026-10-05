// The tangent stage: drops the TANGENT attribute from every primitive no
// material it can wear needs it on, and disposes the accessors the pass
// orphans. Blender exports tangents on every primitive, but a viewer only
// builds a tangent frame for materials whose shading needs one, so on any
// primitive wearing none of those materials the attribute is wasted bytes
// in the shipped model.
import type { Accessor, Document, Material, Primitive } from '@gltf-transform/core'
import { PropertyType } from '@gltf-transform/core'
import type { Clearcoat, MappingList } from '@gltf-transform/extensions'

const TANGENT_ATTRIBUTE = 'TANGENT'
const VARIANTS_EXTENSION = 'KHR_materials_variants'
const ANISOTROPY_EXTENSION = 'KHR_materials_anisotropy'
const CLEARCOAT_EXTENSION = 'KHR_materials_clearcoat'

// The material features that consume a tangent frame, as one named list: a
// normal map, the anisotropy extension, and a clearcoat normal map.
// materialNeedsTangents is the only reader, so a new tangent-consuming
// feature is added to this list exactly once.
const TANGENT_CONSUMING_FEATURES: readonly ((material: Material) => boolean)[] = [
  (material) => material.getNormalTexture() !== null,
  (material) => material.getExtension(ANISOTROPY_EXTENSION) !== null,
  (material) => {
    const clearcoat = material.getExtension<Clearcoat>(CLEARCOAT_EXTENSION)
    return clearcoat !== null && clearcoat.getClearcoatNormalTexture() !== null
  },
]

// Whether the material's shading needs a tangent frame, which the TANGENT
// attribute provides to the renderer.
export function materialNeedsTangents(material: Material): boolean {
  return TANGENT_CONSUMING_FEATURES.some((consumesTangents) => consumesTangents(material))
}

// Every material a primitive can wear: its default material, and every
// material its variant mappings point at. Finishes swap materials at
// runtime, so the variant materials decide the primitive's tangents as
// much as its default one does.
export function listPrimitiveMaterials(primitive: Primitive): Material[] {
  const materials: Material[] = []
  const defaultMaterial = primitive.getMaterial()
  if (defaultMaterial !== null) {
    materials.push(defaultMaterial)
  }
  const mappingList = primitive.getExtension<MappingList>(VARIANTS_EXTENSION)
  if (mappingList === null) {
    return materials
  }
  for (const mapping of mappingList.listMappings()) {
    const material = mapping.getMaterial()
    if (material !== null) {
      materials.push(material)
    }
  }
  return materials
}

// The outcome of one pass over a document, as the run report prints it.
export type TangentReport = {
  // Primitives that carried TANGENT into the pass and lost it.
  primitivesStripped: number
  // Primitives that carried TANGENT into the pass and kept it, because a
  // material they can wear needs a tangent frame.
  primitivesKept: number
  // Uncompressed bytes of the accessors the pass disposed. A shared
  // accessor a kept primitive still references counts nothing, because it
  // still rides in the file.
  accessorBytesRemoved: number
}

// Whether any property still references the accessor. This is the same
// unused rule the prune transform applies, read here so the stage can
// dispose exactly the accessors its own pass orphaned and nothing else.
function isStillReferenced(accessor: Accessor): boolean {
  return accessor.listParents().some((parent) => parent.propertyType !== PropertyType.ROOT)
}

// Drops TANGENT from every primitive none of its wearable materials needs
// it on. The pass also disposes the accessors it orphaned: the writer
// carries every accessor listed on the document root, and the geometry
// pass that follows runs with pruning disabled to keep the Blender
// contract's nodes, so the orphans would otherwise ride in the file.
export function dropUnusedTangents(doc: Document): TangentReport {
  const orphaned = new Set<Accessor>()
  let primitivesStripped = 0
  let primitivesKept = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const tangent = primitive.getAttribute(TANGENT_ATTRIBUTE)
      if (tangent === null) {
        continue
      }
      if (listPrimitiveMaterials(primitive).some(materialNeedsTangents)) {
        primitivesKept += 1
        continue
      }
      primitive.setAttribute(TANGENT_ATTRIBUTE, null)
      orphaned.add(tangent)
      primitivesStripped += 1
    }
  }
  let accessorBytesRemoved = 0
  for (const accessor of orphaned) {
    if (isStillReferenced(accessor)) {
      continue
    }
    accessorBytesRemoved += accessor.getByteLength()
    accessor.dispose()
  }
  return { primitivesStripped, primitivesKept, accessorBytesRemoved }
}
