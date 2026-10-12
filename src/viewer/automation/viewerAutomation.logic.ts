import type { ProductFailure, ProductModelCounts, ProductRigSummary } from '@lib/product'
import type { ProductStatus, RendererStatus } from '@store/index'

// The derivation table of the automation's store-backed fields: one pure
// function per field, from the store status the bridge selects to the value
// the hook reports. The automation getters call these at access time, so
// the hook never holds a copy of the store's state.

// The model a stage has presented, exactly as the automation hook reports
// it. Its source is the store's ready status, which carries the counts
// measured once at load; a non-null model is a presented product, never one
// whose render pipelines may still be pending.
export type ViewerModel = ProductModelCounts & {
  readonly slug: string
}

// The renderer's failure reason, or null while the renderer has not failed.
export function rendererFailureOf(status: RendererStatus): string | null {
  return status.kind === 'failed' ? status.reason : null
}

// The slug of the product the store is working on, or null while it works
// on none.
export function productSlugOf(status: ProductStatus): string | null {
  return status.kind === 'idle' ? null : status.slug
}

// The product's typed failure, its kind and the facts its channel
// computed, or null while the product has not failed.
export function productFailureOf(status: ProductStatus): ProductFailure | null {
  return status.kind === 'failed' ? status.failure : null
}

// The rig summary the product's ready status carried out of the parse, or
// null while the product is not ready. The summary was computed once at
// parse time; it is never recomputed per access.
export function productRigOf(status: ProductStatus): ProductRigSummary | null {
  return status.kind === 'ready' ? status.rig : null
}

// The model the stage has presented, or null while none is presented. A
// non-null model is a presented product, never one whose render pipelines
// may still be pending: the source is the store's ready status, which
// carries the counts measured once at load.
export function productModelOf(status: ProductStatus): ViewerModel | null {
  return status.kind === 'ready'
    ? {
        slug: status.slug,
        meshes: status.model.meshes,
        triangles: status.model.triangles,
        geometryBytes: status.model.geometryBytes,
        textureBytes: status.model.textureBytes,
      }
    : null
}
