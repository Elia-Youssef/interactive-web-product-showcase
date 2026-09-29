// The validate step against the committed placeholder: the real manifest
// file, the real optimized model, the real loaders. This is the
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
import { countViolations, countWarnings } from './validateChecks.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

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

describe('the validate step on the committed placeholder', () => {
  it('reports zero violations and zero warnings', async () => {
    const parseProduct = await loadParseProduct()
    const validation = await validateShippedProduct(ROOT, 'placeholder-speaker', parseProduct)
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
    // The committed placeholder model stands in for a readable model.glb.
    await copyFile(
      productPaths(ROOT, 'placeholder-speaker').modelGlb,
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
