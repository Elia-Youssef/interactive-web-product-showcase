// The fixture product set: the folder listing, the manifest marker and the
// one model path rule that answers the fixture location for a fixture slug
// and the shipped location otherwise.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  fixtureManifestPathOf,
  fixtureModelPathOf,
  isFixtureProductSlug,
  listFixtureProductSlugs,
  modelPathOf,
} from './fixtureProducts.ts'

// Every temp root a test builds, removed after each test.
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

// Builds a temp repo root with the given fixture product folders, each
// carrying a manifest and a model, and one stray folder that carries neither.
async function buildRoot(slugs: readonly string[]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'fixture-test-'))
  roots.push(root)
  for (const slug of slugs) {
    const dir = path.join(root, 'tests', 'fixtures', 'products', slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${slug}.fixtures.ts`), 'data', 'utf8')
    await writeFile(path.join(dir, 'model.glb'), 'glb')
  }
  await mkdir(path.join(root, 'tests', 'fixtures', 'products', 'stray-speaker'), {
    recursive: true,
  })
  await writeFile(path.join(root, 'tests', 'fixtures', 'products', 'stray.txt'), 'not a product')
  return root
}

describe('listFixtureProductSlugs', () => {
  it('lists the folders that carry their own manifest, sorted, once each', async () => {
    const tempDir = await buildRoot(['beta-speaker', 'alpha-speaker'])
    expect(await listFixtureProductSlugs(tempDir)).toEqual(['alpha-speaker', 'beta-speaker'])
  })

  it('lists no slug for a folder without its manifest file', async () => {
    const tempDir = await buildRoot([])
    expect(await listFixtureProductSlugs(tempDir)).toEqual([])
  })
})

describe('isFixtureProductSlug', () => {
  it('answers true for a slug the fixture set holds and false otherwise', async () => {
    const tempDir = await buildRoot(['alpha-speaker'])
    expect(await isFixtureProductSlug(tempDir, 'alpha-speaker')).toBe(true)
    expect(await isFixtureProductSlug(tempDir, 'shipped-speaker')).toBe(false)
  })
})

describe('modelPathOf', () => {
  it('answers the fixture location for a fixture slug', async () => {
    const tempDir = await buildRoot(['alpha-speaker'])
    expect(await modelPathOf(tempDir, 'alpha-speaker')).toBe(
      fixtureModelPathOf(tempDir, 'alpha-speaker'),
    )
    expect(await modelPathOf(tempDir, 'alpha-speaker')).toContain(
      path.join('tests', 'fixtures', 'products', 'alpha-speaker', 'model.glb'),
    )
  })

  it('answers the shipped location otherwise', async () => {
    const tempDir = await buildRoot([])
    expect(await modelPathOf(tempDir, 'shipped-speaker')).toBe(
      path.join(tempDir, 'public', 'models', 'shipped-speaker', 'model.glb'),
    )
  })
})

describe('fixture manifest path', () => {
  it('sits in the slug folder, named by the fixture module marker', async () => {
    const root = path.join('root')
    expect(fixtureManifestPathOf(root, 'alpha-speaker')).toBe(
      path.join(
        'root',
        'tests',
        'fixtures',
        'products',
        'alpha-speaker',
        'alpha-speaker.fixtures.ts',
      ),
    )
  })
})
