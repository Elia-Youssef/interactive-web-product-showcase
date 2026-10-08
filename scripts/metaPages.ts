// The launch pages of the site: every manifest of the products folder,
// parsed, with its head set from the copy builder. The build steps that
// write per-product output, the prerender and the social capture, read
// their product list from here, so the two cannot disagree about which
// products carry link-preview words of their own.
import { fileURLToPath } from 'node:url'
import type { MetaHeadSet, ProductMetaSet } from '../src/lib/copy/meta.ts'
import type { Product } from '../src/lib/product/index.ts'
import { loadCopyMeta, loadParseProduct, readManifestFile } from './manifestIo.ts'
import { productPaths } from './productPaths.ts'
import { listManifestSlugs } from './shippedProducts.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

export type MetaPage = {
  readonly slug: string
  readonly product: Product
  readonly set: ProductMetaSet
}

export type MetaPages = {
  // The head set of the home page.
  readonly site: MetaHeadSet
  // The products with a meta block, in collection order.
  readonly pages: readonly MetaPage[]
  // The products without one, named so a build reports what it left out.
  readonly skipped: readonly string[]
}

// A load failure is the manifest's own problem: the step names the file and
// the reason instead of shipping a product without its words.
function loadedManifest(slug: string, load: Awaited<ReturnType<typeof readManifestFile>>): unknown {
  switch (load.kind) {
    case 'loaded':
      return load.manifest
    case 'missing':
      throw new Error(`the manifest of '${slug}' is missing`)
    case 'noManifestExport':
      throw new Error(`the manifest of '${slug}' has no 'manifest' export`)
    case 'error':
      throw new Error(`the manifest of '${slug}' failed to load: ${load.reason}`)
  }
}

export async function loadMetaPages(): Promise<MetaPages> {
  const slugs = await listManifestSlugs(ROOT)
  const parseProduct = await loadParseProduct()
  const copyMeta = await loadCopyMeta()
  const site = copyMeta.siteMetaSet()
  const pages: MetaPage[] = []
  const skipped: string[] = []
  for (const slug of slugs) {
    const manifestFile = productPaths(ROOT, slug).manifestFile
    const raw = loadedManifest(slug, await readManifestFile(manifestFile))
    const product = parseProduct(raw, manifestFile)
    const set = copyMeta.productMetaSet(product)
    if (set === null) {
      skipped.push(slug)
      continue
    }
    pages.push({ slug, product, set })
  }
  // Collection order, the order the site itself presents the products in.
  pages.sort((left, right) => left.product.number - right.product.number)
  return { site, pages, skipped }
}
