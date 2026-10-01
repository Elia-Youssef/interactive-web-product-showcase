import { fileURLToPath } from 'node:url'
import { createCollection } from '../../src/lib/product'
import type { ProductCollection } from '../../src/lib/product'
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

export async function loadCollection(): Promise<ProductCollection> {
  const slugs = await listShippedSlugs(ROOT)
  const manifests = await Promise.all(
    slugs.map(async (slug) => {
      const load = await readManifestFile(productPaths(ROOT, slug).manifestFile)
      if (load.kind !== 'loaded') {
        const reason = load.kind === 'error' ? `: ${load.reason}` : ''
        throw new Error(`the manifest of '${slug}' did not load (${load.kind}${reason})`)
      }
      return load.manifest
    }),
  )
  return createCollection(manifests)
}
