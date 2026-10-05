// Shared fixtures for the tangent stage tests: one mesh whose primitives
// carry TANGENT accessors and the materials that do or do not need a
// tangent frame, built with @gltf-transform/core so no test needs Blender
// or KTX-Software. Every spec bends one rule, which is how a test asserts
// the exact outcome.
import {
  Document,
  type Accessor,
  type Material,
  type Primitive,
  type Texture,
} from '@gltf-transform/core'
import {
  KHRMaterialsAnisotropy,
  KHRMaterialsClearcoat,
  KHRMaterialsVariants,
} from '@gltf-transform/extensions'
import { pngBytes } from './texture.fixtures.ts'

const VERTEX_COUNT = 4

// The material features a fixture material carries. normalTexture,
// anisotropy and clearcoatNormalTexture are the tangent-consuming ones;
// baseColorTexture is the control that consumes no tangent frame.
export type MaterialSpec = {
  normalTexture?: boolean
  baseColorTexture?: boolean
  anisotropy?: boolean
  clearcoatNormalTexture?: boolean
}

export type PrimitiveSpec = {
  // The primitive's default material; null gives it none. Omitted: a plain
  // material with no tangent-consuming feature.
  material?: MaterialSpec | null
  // One variant mapping per entry, in order.
  variantMaterials?: readonly MaterialSpec[]
  // Whether the primitive carries TANGENT. Default true.
  tangent?: boolean
  // Share the mesh's one TANGENT accessor instead of an own one, the way a
  // mesh's primitives share their attributes after a dedup pass.
  sharedTangent?: boolean
}

function positionAccessor(doc: Document): Accessor {
  return doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(VERTEX_COUNT * 3))
}

function indicesAccessor(doc: Document): Accessor {
  return doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
}

function tangentAccessor(doc: Document): Accessor {
  return doc
    .createAccessor()
    .setType('VEC4')
    .setArray(new Float32Array(VERTEX_COUNT * 4))
}

function fixtureTexture(doc: Document, name: string): Texture {
  return doc.createTexture(name).setImage(pngBytes(4, 4)).setMimeType('image/png')
}

// Builds one fixture material: a texture per requested slot, the anisotropy
// extension when asked, and the clearcoat extension when a clearcoat normal
// texture is asked, so a plain material carries none of the three.
function buildMaterial(
  doc: Document,
  name: string,
  spec: MaterialSpec,
  anisotropy: KHRMaterialsAnisotropy,
  clearcoat: KHRMaterialsClearcoat,
): Material {
  const material = doc.createMaterial(name)
  if (spec.baseColorTexture === true) {
    material.setBaseColorTexture(fixtureTexture(doc, `${name}_baseColor`))
  }
  if (spec.normalTexture === true) {
    material.setNormalTexture(fixtureTexture(doc, `${name}_normal`))
  }
  if (spec.anisotropy === true) {
    material.setExtension('KHR_materials_anisotropy', anisotropy.createAnisotropy())
  }
  if (spec.clearcoatNormalTexture === true) {
    material.setExtension(
      'KHR_materials_clearcoat',
      clearcoat.createClearcoat().setClearcoatNormalTexture(fixtureTexture(doc, `${name}_coat`)),
    )
  }
  return material
}

// Wires the variant mappings of one spec onto its primitive, one mapping
// per requested material, the way the Blender contract exports finishes.
function buildVariantMappings(
  doc: Document,
  variants: KHRMaterialsVariants,
  anisotropy: KHRMaterialsAnisotropy,
  clearcoat: KHRMaterialsClearcoat,
  primitive: Primitive,
  name: string,
  specs: readonly MaterialSpec[],
): void {
  const mappingList = variants.createMappingList()
  specs.forEach((spec, index) => {
    const mapping = variants.createMapping()
    mapping.setMaterial(
      buildMaterial(doc, `MAT_${name}_variant_${index + 1}`, spec, anisotropy, clearcoat),
    )
    mapping.addVariant(variants.createVariant(`${name}_variant_${index + 1}`))
    mappingList.addMapping(mapping)
  })
  primitive.setExtension('KHR_materials_variants', mappingList)
}

// The fixture document: one mesh, one primitive per spec, in spec order.
export function docWithPrimitives(specs: readonly PrimitiveSpec[]): Document {
  const doc = new Document()
  doc.createBuffer()
  const anisotropy = doc.createExtension(KHRMaterialsAnisotropy)
  const clearcoat = doc.createExtension(KHRMaterialsClearcoat)
  const variants = doc.createExtension(KHRMaterialsVariants)
  const mesh = doc.createMesh('fixture-mesh')
  let sharedTangent: Accessor | null = null
  specs.forEach((spec, index) => {
    const name = `primitive_${index + 1}`
    const primitive = doc.createPrimitive()
    primitive.setIndices(indicesAccessor(doc))
    primitive.setAttribute('POSITION', positionAccessor(doc))
    if (spec.tangent !== false) {
      if (spec.sharedTangent === true) {
        if (sharedTangent === null) {
          sharedTangent = tangentAccessor(doc)
        }
        primitive.setAttribute('TANGENT', sharedTangent)
      } else {
        primitive.setAttribute('TANGENT', tangentAccessor(doc))
      }
    }
    if (spec.material !== null) {
      const defaultSpec = spec.material ?? {}
      primitive.setMaterial(buildMaterial(doc, `MAT_${name}`, defaultSpec, anisotropy, clearcoat))
    }
    if ((spec.variantMaterials ?? []).length > 0) {
      buildVariantMappings(
        doc,
        variants,
        anisotropy,
        clearcoat,
        primitive,
        name,
        spec.variantMaterials ?? [],
      )
    }
    mesh.addPrimitive(primitive)
  })
  return doc
}

// The fixture primitive at the given position in the one fixture mesh.
export function primitiveAt(doc: Document, index: number): Primitive {
  const primitive = doc.getRoot().listMeshes()[0]?.listPrimitives()[index]
  if (primitive === undefined) {
    throw new Error(`the fixture primitive ${index} is missing`)
  }
  return primitive
}

// The TANGENT attribute of a primitive, null when it carries none.
export function tangentOf(primitive: Primitive): Accessor | null {
  return primitive.getAttribute('TANGENT')
}

// Every accessor the document still lists, disposed or not.
export function accessorCountOf(doc: Document): number {
  return doc.getRoot().listAccessors().length
}
