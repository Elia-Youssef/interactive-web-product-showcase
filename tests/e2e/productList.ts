import { fileURLToPath } from 'node:url'
import { createCollection } from '../../src/lib/product'
import type { ProductCollection } from '../../src/lib/product'
import {
  fixtureManifestPathOf,
  isFixtureProductSlug,
  listFixtureProductSlugs,
} from '../../scripts/fixtureProducts.ts'
import { readManifestFile } from '../../scripts/manifestIo.ts'
import { productPaths } from '../../scripts/productPaths.ts'
import { listShippedSlugs } from '../../scripts/shippedProducts.ts'

// The manifest list of the app, as the e2e sees it. The app globs the
// manifest folder (src/products/index.ts); the e2e reads the same product
// set through the file-name discovery the validate step uses, and builds its
// expectation by the collection's own rule (createCollection) from those
// files' exports, independent of the viewer's own code path. A manifest
// that joins src/products is in, without a hand-kept row here.

// The repo root: the parent of the tests folder this file lives in.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The manifest file of one slug, wherever the set it belongs to keeps it:
// the shipped location, or the fixture location for a fixture product
// (scripts/fixtureProducts.ts is the one rule).
async function readProductManifest(slug: string): Promise<unknown> {
  const manifestFile = (await isFixtureProductSlug(ROOT, slug))
    ? fixtureManifestPathOf(ROOT, slug)
    : productPaths(ROOT, slug).manifestFile
  const load = await readManifestFile(manifestFile)
  if (load.kind !== 'loaded') {
    const reason = load.kind === 'error' ? `: ${load.reason}` : ''
    throw new Error(`the manifest of '${slug}' did not load (${load.kind}${reason})`)
  }
  return load.manifest
}

export async function loadCollection(): Promise<ProductCollection> {
  const slugs = await listShippedSlugs(ROOT)
  const manifests = await Promise.all(slugs.map(readProductManifest))
  return createCollection(manifests)
}

// The test set: the shipped collection plus the fixture products, one
// collection as the dev harness presents it in dev and e2e. The behavior
// specs that iterate the harness read this set, so a fixture product is
// under test without a change here, and the collection's own cross-product
// validation (duplicate slugs and numbers) keeps the two sets honest.
export async function loadTestCollection(): Promise<ProductCollection> {
  const [shippedSlugs, fixtureSlugs] = await Promise.all([
    listShippedSlugs(ROOT),
    listFixtureProductSlugs(ROOT),
  ])
  const manifests = await Promise.all([...shippedSlugs, ...fixtureSlugs].map(readProductManifest))
  return createCollection(manifests)
}
