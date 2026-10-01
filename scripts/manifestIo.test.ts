// Loading manifests across the src boundary: the .ts manifest file runs
// under plain Node because its only import is a type, and parseProduct
// arrives through the jiti bridge from src/lib/product. The load failures
// are shaped, not thrown, so one broken product cannot stop the run.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadParseProduct, namedExport, readManifestFile } from './manifestIo.ts'
import { productPaths } from './productPaths.ts'
import { listShippedSlugs } from './shippedProducts.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('namedExport', () => {
  const isPresent = (value: unknown): value is unknown => value !== undefined
  const isText = (value: unknown): value is string => typeof value === 'string'

  it('reads a present export of the checked kind', () => {
    expect(namedExport({ text: 'here' }, 'text', isText)).toEqual({
      kind: 'present',
      value: 'here',
    })
  })

  it('reports an absent export', () => {
    expect(namedExport({}, 'text', isText)).toEqual({ kind: 'absent' })
    expect(namedExport({ other: 1 }, 'text', isText)).toEqual({ kind: 'absent' })
    expect(namedExport(null, 'text', isText)).toEqual({ kind: 'absent' })
    expect(namedExport('not an object', 'text', isText)).toEqual({ kind: 'absent' })
  })

  it('reports an export of the wrong kind', () => {
    expect(namedExport({ text: 42 }, 'text', isText)).toEqual({ kind: 'absent' })
    expect(namedExport({ text: undefined }, 'text', isPresent)).toEqual({ kind: 'absent' })
  })
})

describe('readManifestFile', () => {
  it('loads every shipped manifest as plain data, under its own slug', async () => {
    for (const slug of await listShippedSlugs(ROOT)) {
      const load = await readManifestFile(productPaths(ROOT, slug).manifestFile)
      expect(load, slug).toEqual({
        kind: 'loaded',
        manifest: expect.objectContaining({ slug }),
      })
    }
  })

  it('reports a missing manifest file', async () => {
    const load = await readManifestFile(productPaths(ROOT, 'no-such-product').manifestFile)
    expect(load).toEqual({ kind: 'missing' })
  })

  describe('over temp fixtures', () => {
    let tempDir = ''

    beforeAll(async () => {
      // Under the repo root's scratch/, gitignored, so the import runs
      // through the same loader the validate step uses, from any working
      // directory.
      const scratchRoot = path.join(ROOT, 'scratch')
      await mkdir(scratchRoot, { recursive: true })
      tempDir = await mkdtemp(path.join(scratchRoot, 'manifest-io-test-'))
      await writeFile(
        path.join(tempDir, 'no-export.ts'),
        'export const notTheManifest = true\n',
        'utf8',
      )
      await writeFile(
        path.join(tempDir, 'broken.ts'),
        `throw new Error('broken manifest module')\n`,
        'utf8',
      )
    })

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true })
    })

    it('reports a module with no manifest export', async () => {
      const load = await readManifestFile(path.join(tempDir, 'no-export.ts'))
      expect(load).toEqual({ kind: 'noManifestExport' })
    })

    it('reports a module that fails to load, with its reason', async () => {
      const load = await readManifestFile(path.join(tempDir, 'broken.ts'))
      expect(load).toEqual({
        kind: 'error',
        reason: expect.stringContaining('broken manifest module'),
      })
    })
  })
})

describe('loadParseProduct', () => {
  it('loads the real parser and names a broken manifest by its fields', async () => {
    const parseProduct = await loadParseProduct()
    const parsed = parseProduct(
      {
        slug: 'fixture-speaker',
        number: 2,
        category: 'Audio',
        brand: 'Sample',
        model: 'Speaker',
        eyebrow: 'Compact speaker / 002',
        tagline: 'A quiet box that fills the room.',
        intro: [],
        finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' }],
        hotspots: [],
      },
      'fixture.ts',
    )
    expect(parsed.slug).toBe('fixture-speaker')
    expect(() => parseProduct({ slug: 'fixture-speaker' }, 'fixture.ts')).toThrow(/finishes/)
  })
})
