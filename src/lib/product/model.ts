// The model location rule of the collection:
// a product's model lives at public/models/<slug>/model.glb. The slug alone
// decides the URL, so a component can never carry a model path of its own.

export function modelUrl(slug: string): string {
  return `/models/${slug}/model.glb`
}
