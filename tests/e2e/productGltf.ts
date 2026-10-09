import { fileURLToPath } from 'node:url'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { AnimationClip, Group } from 'three'
import type { Document } from '@gltf-transform/core'
import { modelPathOf } from '../../scripts/fixtureProducts.ts'
import { createModelIO } from '../../scripts/modelIo.ts'

// The runtime side of the agreement proof: each shipped `.glb` parsed by
// three's real GLTFLoader, the loader the site loads with, so the proof
// runs the runtime's own loader path over the shipped file's real geometry
// and transforms and cannot agree with the build-time facts by
// construction. The copy the loader reads carries no textures (the parse
// runs in Node, where no texture image can load, and no fact the proof
// reads lives in a texture) and no meshopt compression (the wrapper is
// stripped before the write, so no encoder is needed; the accessor data
// and its normalized flags are untouched, and the loader still reads the
// quantized values through KHR_mesh_quantization).

// The parsed product, as the product path reads it: the scene tree, the
// animation clips the rig resolves its explode clip from, and the raw glTF
// JSON the rig reads its contract names and variants from.
export type ParsedProduct = {
  readonly scene: Group
  readonly animations: AnimationClip[]
  readonly json: unknown
}

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export async function parseShippedGltf(slug: string): Promise<ParsedProduct> {
  return parseGltfWithLoader(await modelPathOf(ROOT, slug))
}

// Parses one .glb file with the real loader, for the fixture files the
// drift tests build beside the shipped products.
export async function parseGltfWithLoader(modelPath: string): Promise<ParsedProduct> {
  const io = await createModelIO()
  return parseDocumentWithLoader(await io.read(modelPath))
}

// Parses a model document with the real loader, for the cases that bend a
// shipped document in memory before the parse. The parse strips the
// document's textures and its meshopt wrapper in place, so a caller reads
// every build-time fact it needs from the document first.
export async function parseDocumentWithLoader(doc: Document): Promise<ParsedProduct> {
  const io = await createModelIO()
  for (const material of doc.getRoot().listMaterials()) {
    material.setBaseColorTexture(null)
    material.setNormalTexture(null)
    material.setMetallicRoughnessTexture(null)
    material.setOcclusionTexture(null)
    material.setEmissiveTexture(null)
  }
  for (const texture of doc.getRoot().listTextures()) {
    texture.dispose()
  }
  for (const extension of doc.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === 'EXT_meshopt_compression') {
      extension.dispose()
    }
  }
  // The stripped copy lives in memory only: the loader parses the bytes the
  // write produces, and no file outlives the parse.
  const bytes = await io.writeBinary(doc)
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

  await MeshoptDecoder.ready
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf: GLTF = await loader.parseAsync(arrayBuffer, '')
  return { scene: gltf.scene, animations: gltf.animations, json: gltf.parser.json }
}
