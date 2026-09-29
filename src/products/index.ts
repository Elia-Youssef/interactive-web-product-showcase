import type { ProductInput } from '@lib/product'

// The derived product index: the manifest set is read off the
// file names, so adding a product is adding a manifest file and nothing
// else. The marker in the file names (scripts/productPaths.ts) is the same
// one the validate step lists, so the browser bundle and the Node gate read
// the same product set in both directions.
const manifestModules = import.meta.glob<ProductInput>('./*.manifest.ts', {
  eager: true,
  import: 'manifest',
})

// The raw manifests of the collection, in file name order. Callers validate
// them once through the product domain's own parse, never by trusting the
// files' shape.
export const productManifests: readonly ProductInput[] = Object.values(manifestModules)
