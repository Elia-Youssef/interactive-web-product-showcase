// The model counts of a presented product: the meshes and triangles of the
// loaded scene, measured once at load. They ride with the ready status, so
// the automation hook never recomputes them per access. Pure data: no
// three.js types here, because the store layer may import lib only.
export type ProductModelCounts = {
  readonly meshes: number
  readonly triangles: number
}
