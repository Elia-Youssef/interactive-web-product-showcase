// Shared fixtures for the encode plan, stage and pipeline tests: a minimal
// but valid PNG header, a placeholder KTX2 payload, recording runners, and
// a document builder that wires one texture into named material slots.
import { Document, type Material, type Texture } from '@gltf-transform/core'
import { KHRMaterialsClearcoat } from '@gltf-transform/extensions'
import { writeFile } from 'node:fs/promises'
import type { CliRunner } from './pipeline.ts'
import type { Ktx2Runner } from './ktx2Encode.ts'

// A minimal but valid PNG header: signature and IHDR with the dimensions,
// which is all the document reads for getSize.
export function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width, false)
  view.setUint32(20, height, false)
  bytes.set([8, 6, 0, 0, 0, 0, 0, 0, 0], 24)
  return bytes
}

export const KTX2_PLACEHOLDER = Uint8Array.from([0xab, 0x4b, 0x54, 0x58])

// The value of a flag that takes one, for assertions that name the flag.
export function argValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

// A runner that stands in for ktx: it records every call and writes the
// placeholder KTX2 payload to the output path, the last argument.
export function recordedKtxRunner(): { runKtx: Ktx2Runner; calls: string[][] } {
  const calls: string[][] = []
  const runKtx: Ktx2Runner = async (args) => {
    calls.push([...args])
    await writeFile(args[args.length - 1] ?? '', KTX2_PLACEHOLDER)
  }
  return { runKtx, calls }
}

// A runner that stands in for the gltf-transform CLI: it records calls.
export function recordedCliRunner(): { run: CliRunner; calls: string[][] } {
  const calls: string[][] = []
  const run: CliRunner = async (args) => {
    calls.push([...args])
  }
  return { run, calls }
}

export type TextureFixture = {
  name: string
  // The material slots that reference the texture, wired in order onto one
  // material per texture.
  slots: readonly string[]
  // The material's alpha mode; BLEND keeps the alpha channel in the color
  // texture's channel mask.
  alphaMode?: 'OPAQUE' | 'BLEND'
}

// Wires one texture per fixture definition into the named slots of one
// material, so a document can hold one texture per texture class.
export function docWithTextures(defs: readonly TextureFixture[]): Document {
  const doc = new Document()
  const clearcoatExtension = doc.createExtension(KHRMaterialsClearcoat)
  for (const def of defs) {
    const texture = doc
      .createTexture(def.name)
      .setImage(pngBytes(1024, 1024))
      .setMimeType('image/png')
    const material: Material = doc.createMaterial(`MAT_${def.name}`)
    if (def.alphaMode !== undefined) {
      material.setAlphaMode(def.alphaMode)
    }
    for (const slot of def.slots) {
      if (slot === 'occlusionTexture') {
        material.setOcclusionTexture(texture)
      } else if (slot === 'normalTexture') {
        material.setNormalTexture(texture)
      } else if (slot === 'baseColorTexture') {
        material.setBaseColorTexture(texture)
      } else if (slot === 'metallicRoughnessTexture') {
        material.setMetallicRoughnessTexture(texture)
      } else if (slot === 'emissiveTexture') {
        material.setEmissiveTexture(texture)
      } else if (slot === 'clearcoatNormalTexture') {
        const clearcoat = clearcoatExtension.createClearcoat().setClearcoatNormalTexture(texture)
        material.setExtension('KHR_materials_clearcoat', clearcoat)
      } else {
        throw new Error(`texture fixture does not know slot '${slot}'`)
      }
    }
  }
  return doc
}

// The texture of one fixture definition, found by its fixture name.
export function textureByName(doc: Document, name: string): Texture | undefined {
  return doc
    .getRoot()
    .listTextures()
    .find((texture) => texture.getName() === name)
}
