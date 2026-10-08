// The shipped products of the collection, discovered in both directions:
// every folder under public/models is one product, and every
// src/products/<slug>.manifest.ts is one. The product set is the union of
// the two slugs, sorted, so either half alone still names a product and its
// missing side is that product's violation, never a silent skip. A stray
// file in either folder is no product: only folders under public/models and
// only files carrying the manifest marker count.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { isMissingFileError } from './fsErrors.ts'
import { MANIFEST_SUFFIX } from './productPaths.ts'

async function listModelSlugs(root: string): Promise<string[]> {
  const modelsDir = path.join(root, 'public', 'models')
  try {
    const entries = await readdir(modelsDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error
    }
    return []
  }
}

// The slugs of the manifest files alone: the products the site has words
// for. The validate step needs the union with the model folders below; the
// build steps that write per-product output (the prerender, the social
// capture) read this list, since a route exists only for a manifest.
export async function listManifestSlugs(root: string): Promise<string[]> {
  const productsDir = path.join(root, 'src', 'products')
  try {
    const entries = await readdir(productsDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(MANIFEST_SUFFIX))
      .map((entry) => entry.name.slice(0, -MANIFEST_SUFFIX.length))
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error
    }
    return []
  }
}

export async function listShippedSlugs(root: string): Promise<string[]> {
  const [modelSlugs, manifestSlugs] = await Promise.all([
    listModelSlugs(root),
    listManifestSlugs(root),
  ])
  const slugs = [...new Set([...modelSlugs, ...manifestSlugs])].sort()
  if (slugs.length === 0) {
    throw new Error(
      'No shipped products: add a model folder under public/models ' +
        `or a manifest file under src/products, named <slug>${MANIFEST_SUFFIX}.`,
    )
  }
  return slugs
}
