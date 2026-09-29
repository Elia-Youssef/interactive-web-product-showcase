import { createCollection } from '../../src/lib/product'
import type { ProductCollection } from '../../src/lib/product'
import { manifest as standIn } from '../../src/products/stand-in.manifest'

// The manifest list of the app, as the e2e sees it. The app globs the
// manifest folder (src/products/index.ts); the e2e process has no folder
// listing, so this list imports the same manifest files statically and the
// expectation is built by the same rule (createCollection) from the same
// data, independent of the viewer's own code path. A manifest that joins
// src/products gets a row here.
const productManifests: readonly unknown[] = [standIn]

export function loadCollection(): ProductCollection {
  return createCollection(productManifests)
}
