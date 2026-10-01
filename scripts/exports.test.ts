// The slug discovery: a product folder without an export is the normal
// case and is skipped; the listing covers every product folder with one.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listExportedSlugs } from './exports.ts'

describe('listExportedSlugs', () => {
  let root = ''

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'exports-test-'))
    const blenderDir = path.join(root, 'assets', 'blender')
    for (const slug of ['good', 'aardvark']) {
      const exportDir = path.join(blenderDir, slug, 'export')
      await mkdir(exportDir, { recursive: true })
      await writeFile(path.join(exportDir, `${slug}.glb`), 'glb')
    }
    // A product folder without an export: the normal case, skipped.
    await mkdir(path.join(blenderDir, 'empty'), { recursive: true })
    // A stray file next to the product folders is never a slug.
    await writeFile(path.join(blenderDir, 'stray.txt'), 'x')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists the products with an export, sorted, and skips the rest', async () => {
    await expect(listExportedSlugs(root)).resolves.toEqual(['aardvark', 'good'])
  })

  it('fails when no product has an export', async () => {
    const emptyRoot = await mkdtemp(path.join(tmpdir(), 'exports-empty-'))
    try {
      await mkdir(path.join(emptyRoot, 'assets', 'blender', 'nothing'), { recursive: true })
      await expect(listExportedSlugs(emptyRoot)).rejects.toThrow(/No product exports found/)
    } finally {
      await rm(emptyRoot, { recursive: true, force: true })
    }
  })
})
