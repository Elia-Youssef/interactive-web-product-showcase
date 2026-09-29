// Discovery of the shipped products, in both directions: the
// product set is the union of the public/models folders and the
// src/products manifest slugs, so either half alone still names a product.
// A stray file in either folder is no product and is never listed.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { MANIFEST_SUFFIX } from './productPaths.ts'
import { listShippedSlugs } from './shippedProducts.ts'

// Builds a temp repo root with the given model folders and manifest files,
// plus one stray file in each folder.
async function buildRoot(
  modelSlugs: readonly string[],
  manifestSlugs: readonly string[],
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'shipped-test-'))
  const modelsDir = path.join(root, 'public', 'models')
  const productsDir = path.join(root, 'src', 'products')
  await mkdir(modelsDir, { recursive: true })
  await mkdir(productsDir, { recursive: true })
  for (const slug of modelSlugs) {
    await mkdir(path.join(modelsDir, slug), { recursive: true })
    await writeFile(path.join(modelsDir, slug, 'model.glb'), 'glb')
  }
  for (const slug of manifestSlugs) {
    await writeFile(path.join(productsDir, `${slug}${MANIFEST_SUFFIX}`), 'data', 'utf8')
  }
  await writeFile(path.join(modelsDir, 'stray.txt'), 'not a product')
  await writeFile(path.join(productsDir, 'index.ts'), 'not a manifest', 'utf8')
  return root
}

describe('listShippedSlugs', () => {
  let tempDir = ''

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('unions the model folders and the manifest slugs, sorted, once each', async () => {
    tempDir = await buildRoot(['alpha-speaker', 'gamma-speaker'], ['beta-speaker', 'gamma-speaker'])
    const slugs = await listShippedSlugs(tempDir)
    expect(slugs).toEqual(['alpha-speaker', 'beta-speaker', 'gamma-speaker'])
  })

  it('lists a slug only a manifest names', async () => {
    tempDir = await buildRoot([], ['ghost-speaker'])
    expect(await listShippedSlugs(tempDir)).toEqual(['ghost-speaker'])
  })

  it('lists a slug only a model folder names', async () => {
    tempDir = await buildRoot(['orphan-speaker'], [])
    expect(await listShippedSlugs(tempDir)).toEqual(['orphan-speaker'])
  })

  it('fails loudly when nothing is shipped', async () => {
    const emptyRoot = await mkdtemp(path.join(tmpdir(), 'shipped-empty-'))
    try {
      await expect(listShippedSlugs(emptyRoot)).rejects.toThrow(/No shipped products/)
    } finally {
      await rm(emptyRoot, { recursive: true, force: true })
    }
  })
})
