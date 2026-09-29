// Where a product's model lives at runtime: the optimized GLB the pipeline
// writes, served from public/models. The manifest slug is the folder name,
// so the URL is derived, never configured per product.
export function productModelUrl(slug: string): string {
  return `/models/${slug}/model.glb`
}
