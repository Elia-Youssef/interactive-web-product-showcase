import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRLightsPunctual, type MappingList } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadParseProduct, type ParseProduct } from './manifestIo.ts'
import { POSITION_QUANTIZE_BITS } from './settings.ts'
import { positionGridOf } from './storageGrid.ts'
import { addRootNode, buildDocument, nodeNamed } from './validateFixtures.ts'
import { validateShippedProduct } from './validateProduct.ts'
import { pngBytes } from './texture.fixtures.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const GRID = await positionGridOf(POSITION_QUANTIZE_BITS)

function independentlyInvalidDocument() {
  const doc = buildDocument({ cameraNames: [] })
  addRootNode(doc, 'PREVIEW_front')
  addRootNode(doc, 'PART_base')
  nodeNamed(doc, 'PART_base').setExtras({ note: 'unexpected' })
  const lights = doc.createExtension(KHRLightsPunctual)
  nodeNamed(doc, 'PART_base').setExtension('KHR_lights_punctual', lights.createLight())
  nodeNamed(doc, 'PART_knob').setRotation([0, 0, Math.SQRT1_2, Math.SQRT1_2])
  const primitive = nodeNamed(doc, 'PART_knob').getMesh()?.listPrimitives()[0]
  const indices = primitive?.getIndices()
  if (primitive === undefined || indices === null || indices === undefined)
    throw new Error('missing fixture triangles')
  indices.setArray(new Uint16Array([0, 1, 2, 0, 2, 3, 0, 2, 3]))
  primitive.setMaterial(
    doc
      .createMaterial('bumped')
      .setAlphaMode('MASK')
      .setNormalTexture(doc.createTexture().setMimeType('image/png').setImage(pngBytes(4, 4))),
  )
  for (const material of doc.getRoot().listMaterials()) material.setOcclusionTexture(null)
  const shadow = nodeNamed(doc, 'SHADOW').getMesh()?.listPrimitives()[0]?.getMaterial()
  shadow?.setAlphaMode('OPAQUE').setExtension('KHR_materials_unlit', null)
  const body = nodeNamed(doc, 'PART_body').getMesh()?.listPrimitives()[0]
  const mappings = body?.getExtension<MappingList>('KHR_materials_variants')?.listMappings()
  const mapping = mappings?.[1]
  if (mapping === undefined) throw new Error('missing fixture mapping')
  mapping.setMaterial(null)
  for (const variant of mapping.listVariants()) mapping.removeVariant(variant)
  const output = doc.getRoot().listAnimations()[0]?.listSamplers()[0]?.getOutput()
  output?.setArray(new Float32Array([0, 0, 0, 0, 0, 0]))
  return doc
}

describe('independent validation inputs', () => {
  let tempRoot = ''
  let parseProduct: ParseProduct

  beforeAll(async () => {
    await mkdir(path.join(ROOT, 'scratch'), { recursive: true })
    tempRoot = await mkdtemp(path.join(ROOT, 'scratch', 'independent-inputs-'))
    await mkdir(path.join(tempRoot, 'src', 'products'), { recursive: true })
    await MeshoptEncoder.ready
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    })
    for (const slug of ['missing', 'malformed']) {
      const directory = path.join(tempRoot, 'public', 'models', slug)
      await mkdir(directory, { recursive: true })
      await io.write(path.join(directory, 'model.glb'), independentlyInvalidDocument())
    }
    await writeFile(
      path.join(tempRoot, 'src', 'products', 'malformed.manifest.ts'),
      'export const manifest = { slug: 42 }',
    )
    parseProduct = await loadParseProduct()
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  it.each(['missing', 'malformed'])(
    'reports every planted model finding with a %s manifest',
    async (slug) => {
      const validation = await validateShippedProduct(tempRoot, slug, parseProduct, GRID)
      expect(validation.checks.find((check) => check.name === 'manifest')?.status).toBe('fail')
      const keys = validation.checks
        .flatMap((check) => check.violations)
        .filter((message) => /^[a-z]+(?:-[a-z]+)+: /.test(message))
        .map((message) => message.split(': ')[0])
      expect([...new Set(keys)].sort()).toEqual([
        'clip-no-dead-head-or-tail',
        'home-holds-both-poses',
        'lit-materials-occluded',
        'lit-materials-opaque',
        'mappings-cover-every-variant',
        'no-duplicate-triangles',
        'no-extras',
        'no-lights',
        'nodes-carry-contract-names',
        'one-node-per-contract-name',
        'one-occlusion-image',
        'only-allowed-extensions',
        'parts-root-location-only',
        'shadow-material-unlit-blend',
        'storage-matches-pipeline',
        'tangents-with-normal-maps',
        'variant-map-well-formed',
      ])
      for (const group of ['model', 'cameras', 'geometry', 'finishes', 'materials', 'explode']) {
        expect(validation.checks.find((check) => check.name === group)?.status, group).toBe('fail')
      }
      expect(validation.checks.find((check) => check.name === 'hotspots')?.detail).toContain(
        'the manifest did not load',
      )
      expect(validation.checks.find((check) => check.name === 'finishes')?.detail).toContain(
        'default-is-first-finish: skipped: missing manifest',
      )
      expect(validation.checks.find((check) => check.name === 'cameras')?.detail).toContain(
        'authored-minimum-needed: skipped: missing manifest',
      )
    },
  )
})
