// The fixture products of the test set: the product-shaped models and
// manifests that exist for behavior specs alone and never ship. The set
// lives in one folder, one subfolder per slug carrying the fixture manifest
// and the model, so listing it and resolving its paths is one rule here;
// every reader of a fixture product (the dev harness, the e2e facts
// helpers, the validate suites) resolves through this module and never by
// hand. A fixture slug that names a shipped product too is a setup error:
// the model path rule refuses it, and the collection the test set builds
// fails on the duplicate, so the two sets stay disjoint.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { isFile } from './fsErrors.ts'
import { productPaths } from './productPaths.ts'
import { isShippedSlug } from './shippedProducts.ts'

// The marker that makes a file in a fixture folder the product's manifest:
// <slug>.fixtures.ts exporting `manifest`. The fixture module marker puts
// the file in the lint gate's own fixture kind: test support no production
// module imports.
export const FIXTURE_MANIFEST_SUFFIX = '.fixtures.ts'

// Where the fixture products live, under the repo root.
export function fixtureProductsDir(root: string): string {
  return path.join(root, 'tests', 'fixtures', 'products')
}

export function fixtureModelPathOf(root: string, slug: string): string {
  return path.join(fixtureProductsDir(root), slug, 'model.glb')
}

export function fixtureManifestPathOf(root: string, slug: string): string {
  return path.join(fixtureProductsDir(root), slug, `${slug}${FIXTURE_MANIFEST_SUFFIX}`)
}

// The slugs of the fixture set: the folders under the fixture products dir
// that carry their own manifest file. A folder without a manifest is no
// fixture product, the way a folder without a manifest is no shipped one.
export async function listFixtureProductSlugs(root: string): Promise<string[]> {
  const entries = await readdir(fixtureProductsDir(root), { withFileTypes: true })
  const slugs: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (await isFile(fixtureManifestPathOf(root, entry.name))) {
      slugs.push(entry.name)
    }
  }
  return slugs.sort()
}

export async function isFixtureProductSlug(root: string, slug: string): Promise<boolean> {
  return isFile(fixtureManifestPathOf(root, slug))
}

// The model file of one slug, wherever the set it belongs to keeps it: the
// fixture location when the slug is a fixture product, the shipped location
// when it is not. The one disk rule the Node-side readers of a product
// model resolve through, so a spec that takes a fixture slug reads the
// fixture bytes without knowing the sets exist. A slug in both sets has no
// one answer, so it is refused, naming both places.
export async function modelPathOf(root: string, slug: string): Promise<string> {
  const shippedModel = productPaths(root, slug).modelGlb
  if (!(await isFixtureProductSlug(root, slug))) {
    return shippedModel
  }
  if (await isShippedSlug(root, slug)) {
    throw new Error(
      `'${slug}' is a fixture product under ${fixtureProductsDir(root)} and a shipped ` +
        'product too: the two product sets never share a slug',
    )
  }
  return fixtureModelPathOf(root, slug)
}
