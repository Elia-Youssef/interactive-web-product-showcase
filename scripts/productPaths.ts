// Pipeline path shapes. One source of truth: every script derives product
// paths from here, never by hand.
import path from 'node:path'

export type ProductPaths = {
  slug: string
  // Raw Blender export, straight out of the glTF exporter (gitignored).
  exportGlb: string
  // Optional per-product optimize settings override (committed data).
  settingsFile: string
  // Optimized model the site loads.
  modelGlb: string
}

export function productPaths(root: string, slug: string): ProductPaths {
  return {
    slug,
    exportGlb: path.join(root, 'assets', 'blender', slug, 'export', `${slug}.glb`),
    settingsFile: path.join(root, 'assets', 'blender', slug, 'pipeline.json'),
    modelGlb: path.join(root, 'public', 'models', slug, 'model.glb'),
  }
}
