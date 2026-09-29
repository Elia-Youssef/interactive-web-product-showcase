// Pipeline path shapes and the product manifest marker. One source of
// truth: every script derives product paths from here, never by hand.
import path from 'node:path'

// The marker that makes a file in src/products a product manifest:
// src/products/<slug>.manifest.ts, exporting `manifest`.
// The path below and the listing in shippedProducts.ts both derive from it,
// so the Node gate and the Vite import.meta.glob glob read the same product
// set off the file names, and a file without the marker is no product.
export const MANIFEST_SUFFIX = '.manifest.ts'

export type ProductPaths = {
  slug: string
  // Raw Blender export, straight out of the glTF exporter (gitignored).
  exportGlb: string
  // Optional per-product optimize settings override (committed data).
  settingsFile: string
  // Optimized model the site loads.
  modelGlb: string
  // Manifest file of the shipped-product convention: one per product.
  manifestFile: string
}

export function productPaths(root: string, slug: string): ProductPaths {
  return {
    slug,
    exportGlb: path.join(root, 'assets', 'blender', slug, 'export', `${slug}.glb`),
    settingsFile: path.join(root, 'assets', 'blender', slug, 'pipeline.json'),
    modelGlb: path.join(root, 'public', 'models', slug, 'model.glb'),
    manifestFile: path.join(root, 'src', 'products', `${slug}${MANIFEST_SUFFIX}`),
  }
}

// A path for people: relative to the repo root, with forward slashes, so a
// report line reads the same on every machine and in every clone. Loaders
// and file reads keep absolute paths.
export function repoPath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/')
}
