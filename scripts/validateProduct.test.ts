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
import { loadParseProduct, type ParseProduct } from './manifestIo.ts'
import { MANIFEST_SUFFIX, productPaths } from './productPaths.ts'
import { validateShippedProduct } from './validateProduct.ts'
import { listShippedSlugs } from './shippedProducts.ts'
import { countViolations, countWarnings } from './validateChecks.ts'

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
      'finishes',
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
    for (const name of ['hotspots', 'cameras', 'finishes', 'explode', 'encoding', 'budgets']) {
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
    for (const name of ['hotspots', 'cameras', 'finishes', 'explode']) {
      expect(validation.checks.find((check) => check.name === name)?.status, name).toBe('skipped')
    }
  })
})
