// The validate step against every shipped product: the real manifest
// files, the real optimized models, the real loaders. This is the
// fresh-clone case: committed files only, zero violations expected.
// The temp-root cases cover discovery's other half: a product named by one
// side only is exactly its missing-side violation, with the repo-relative
// path the report shows.
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { loadParseProduct, type ParseProduct } from './manifestIo.ts'
import { MANIFEST_SUFFIX, productPaths } from './productPaths.ts'
import { validateShippedProduct } from './validateProduct.ts'
import { listShippedSlugs } from './shippedProducts.ts'
import { countViolations, countWarnings } from './validateChecks.ts'
import { buildDocument, PASSING_CAMERA_POSE } from './validateFixtures.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

// The shipped products of this checkout, by the discovery the validate step
// itself runs.
const SHIPPED_SLUGS = await listShippedSlugs(ROOT)

// A manifest file that parses, for a product whose model never exists.
const GHOST_MANIFEST = [
  'export const manifest = {',
  "  slug: 'ghost-speaker',",
  '  number: 2,',
  "  category: 'Audio',",
  "  brand: 'Sample',",
  "  model: 'Speaker',",
  "  eyebrow: 'Compact speaker / 002',",
  "  tagline: 'A quiet box that fills the room.',",
  '  intro: [],',
  "  finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' }],",
  '  hotspots: [],',
  '}',
].join('\n')

describe('the validate step on every shipped product', () => {
  it.each(SHIPPED_SLUGS)('reports zero violations and zero warnings for %s', async (slug) => {
    const parseProduct = await loadParseProduct()
    const validation = await validateShippedProduct(ROOT, slug, parseProduct)
    expect(validation.checks.map((check) => check.name)).toEqual([
      'manifest',
      'model',
      'hotspots',
      'cameras',
      'geometry',
      'finishes',
      'materials',
      'explode',
      'encoding',
      'budgets',
    ])
    expect(countViolations(validation)).toBe(0)
    expect(countWarnings(validation)).toBe(0)
    for (const check of validation.checks) {
      expect(check.status, check.name).toBe('pass')
    }
  })
})

describe('the validate step on a planted product at the old aspect', () => {
  let tempRoot = ''
  let parseProduct: ParseProduct

  beforeAll(async () => {
    const scratchRoot = path.join(ROOT, 'scratch')
    await mkdir(scratchRoot, { recursive: true })
    tempRoot = await mkdtemp(path.join(scratchRoot, 'validate-aspect-test-'))
    await mkdir(path.join(tempRoot, 'src', 'products'), { recursive: true })
    await mkdir(path.join(tempRoot, 'public', 'models', 'planted-speaker'), { recursive: true })
    // The contract document with every camera at the old 16:9 television
    // aspect, written to a real .glb the validate step reads back. The
    // writer encodes the Meshopt marks the fixture carries, so this IO
    // carries the encoder beside the decoder and the planted product is
    // valid except for its camera aspects.
    const doc = buildDocument({
      hotspotNames: ['HS_driver', 'HS_knob'],
      cameraPose: { ...PASSING_CAMERA_POSE, aspect: 16 / 9 },
    })
    await MeshoptEncoder.ready
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    })
    await io.write(path.join(tempRoot, 'public', 'models', 'planted-speaker', 'model.glb'), doc)
    await writeFile(
      path.join(tempRoot, 'src', 'products', `planted-speaker${MANIFEST_SUFFIX}`),
      [
        'export const manifest = {',
        "  slug: 'planted-speaker',",
        '  number: 2,',
        "  category: 'Audio',",
        "  brand: 'Sample',",
        "  model: 'Speaker',",
        "  eyebrow: 'Compact speaker / 002',",
        "  tagline: 'A quiet box that fills the room.',",
        '  intro: [],',
        "  finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' }, { variant: 'graphite', label: 'Graphite', swatch: '#2B2E2C' }],",
        "  hotspots: [{ id: 'driver', eyebrow: 'A closer look', title: 'Full-range driver', bullets: ['Behind the grille'] }],",
        '}',
      ].join('\n'),
      'utf8',
    )
    parseProduct = await loadParseProduct()
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  it('fails by name on every camera aspect', async () => {
    const validation = await validateShippedProduct(tempRoot, 'planted-speaker', parseProduct)
    const cameras = validation.checks.find((check) => check.name === 'cameras')
    expect(cameras?.status).toBe('fail')
    expect(cameras?.violations).toEqual([
      `camera CAM_home carries aspect ratio ${16 / 9}, expected the authored 1600 / 1422`,
      `camera CAM_driver carries aspect ratio ${16 / 9}, expected the authored 1600 / 1422`,
    ])
    // The planted document is a raw write, not an optimized file: beside
    // the two aspect defects the encoding check names its plain PNG, and
    // the storage rule names its float positions and its unfiltered
    // translation output, the storage the pipeline never writes.
    const encoding = validation.checks.find((check) => check.name === 'encoding')
    expect(encoding?.violations).toEqual(["texture 'T_ao' is image/png, expected image/ktx2"])
    const model = validation.checks.find((check) => check.name === 'model')
    expect(model?.violations).toEqual([
      "storage-matches-pipeline: the POSITION of the mesh 'PART_base' is stored as component type 5126, not normalized, the pipeline's 14-bit quantize stores normalized Int16",
      "storage-matches-pipeline: the POSITION of the mesh 'PART_knob' is stored as component type 5126, not normalized, the pipeline's 14-bit quantize stores normalized Int16",
      "storage-matches-pipeline: the POSITION of the mesh 'body-variants' is stored as component type 5126, not normalized, the pipeline's 14-bit quantize stores normalized Int16",
      "storage-matches-pipeline: the POSITION of the mesh 'shadow' is stored as component type 5126, not normalized, the pipeline's 14-bit quantize stores normalized Int16",
      "storage-matches-pipeline: the translation output of 'PART_base' in the animation 'Explode' is stored with filter none, the pipeline's key filter is EXPONENTIAL at 12 bits",
    ])
    expect(countViolations(validation)).toBe(8)
  })
})

describe('the validate step on a temp root, one side missing', () => {
  let tempRoot = ''
  let parseProduct: ParseProduct

  beforeAll(async () => {
    const scratchRoot = path.join(ROOT, 'scratch')
    await mkdir(scratchRoot, { recursive: true })
    tempRoot = await mkdtemp(path.join(scratchRoot, 'validate-product-test-'))
    const productsDir = path.join(tempRoot, 'src', 'products')
    const modelsDir = path.join(tempRoot, 'public', 'models')
    await mkdir(productsDir, { recursive: true })
    await mkdir(path.join(modelsDir, 'orphan-speaker'), { recursive: true })
    // A committed model stands in for a readable model.glb: the first
    // shipped product's, since the case is about the missing manifest.
    const [standIn] = SHIPPED_SLUGS
    if (standIn === undefined) {
      throw new Error('the discovery lists at least one shipped product or fails on its own')
    }
    await copyFile(
      productPaths(ROOT, standIn).modelGlb,
      path.join(modelsDir, 'orphan-speaker', 'model.glb'),
    )
    await writeFile(
      path.join(productsDir, `ghost-speaker${MANIFEST_SUFFIX}`),
      GHOST_MANIFEST,
      'utf8',
    )
    parseProduct = await loadParseProduct()
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  it('validates a manifest-only product as exactly the model missing violation', async () => {
    const validation = await validateShippedProduct(tempRoot, 'ghost-speaker', parseProduct)
    expect(countViolations(validation)).toBe(1)
    const model = validation.checks.find((check) => check.name === 'model')
    expect(model?.violations).toEqual([
      'model missing: expected public/models/ghost-speaker/model.glb',
    ])
    for (const name of [
      'hotspots',
      'cameras',
      'geometry',
      'finishes',
      'materials',
      'explode',
      'encoding',
      'budgets',
    ]) {
      expect(validation.checks.find((check) => check.name === name)?.status, name).toBe('skipped')
    }
  })

  it('validates a model-only product as exactly the manifest missing violation', async () => {
    const validation = await validateShippedProduct(tempRoot, 'orphan-speaker', parseProduct)
    expect(countViolations(validation)).toBe(1)
    const manifest = validation.checks.find((check) => check.name === 'manifest')
    expect(manifest?.violations).toEqual([
      'manifest missing: expected src/products/orphan-speaker.manifest.ts',
    ])
    for (const name of ['hotspots', 'cameras', 'geometry', 'finishes', 'materials', 'explode']) {
      expect(validation.checks.find((check) => check.name === name)?.status, name).toBe('skipped')
    }
  })
})
