// Lists the product slugs that have a raw Blender export, so the optimize
// step can run every product at once. A product folder without an export is
// the normal case and is skipped; an export that cannot be read is an error
// and fails loudly.
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { isMissingFileError } from './fsErrors.ts'
import { productPaths } from './productPaths.ts'

export async function listExportedSlugs(root: string): Promise<string[]> {
  const blenderDir = path.join(root, 'assets', 'blender')
  const entries = await readdir(blenderDir, { withFileTypes: true })
  const slugs: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const exportGlb = productPaths(root, entry.name).exportGlb
    try {
      await stat(exportGlb)
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error
      }
      continue
    }
    slugs.push(entry.name)
  }
  if (slugs.length === 0) {
    throw new Error(
      `No product exports found under ${blenderDir}. Export a product from Blender first.`,
    )
  }
  return slugs.sort()
}
