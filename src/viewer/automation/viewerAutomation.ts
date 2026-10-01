import type { ProductRigSummary, ProductModelCounts } from '@lib/product'
import type { RendererBackend } from '@lib/renderer/backend'
import { selectRendererBackend, type ProductStatus, type RendererStatus } from '@store/index'

// The test contract of the viewer, installed as window.__viewer in every
// build. Every field is a getter: the renderer fields are read from the
// store at access time, the product fields the same way, and the frame
// field from the stage's frame clock, so the hook holds no copies that can
// go stale.

// The model a stage has presented, exactly as the automation hook reports
// it. Its source is the store's ready status, which carries the counts
// measured once at load; a non-null model is a presented product, never one
// whose render pipelines may still be pending.
export type ViewerModel = ProductModelCounts & {
  readonly slug: string
}

// The applied state of the shadow material, read back from the material
// itself: the opacity the look left on it and the flags its compositing
// depends on.
export type ViewerLookShadow = {
  readonly opacity: number
  readonly transparent: boolean
  readonly depthWrite: boolean
}

// One loaded texture as the color management check reads it: the material
// that carries it, the material slot it sits in, and the color space the
// loader left on it.
export type ViewerLookTexture = {
  readonly material: string
  readonly slot: string
  readonly colorSpace: string
}

// The look of the stage, read back from the renderer, the scene and the
// shadow material at access time. Null while no product's look has ever been
// applied on this stage; the shadow and texture fields are null while no
// product is mounted, so the getter still proves the restore of the renderer
// and scene values after the product leaves.
export type ViewerLook = {
  readonly exposure: number
  readonly environmentIntensity: number
  readonly environmentRotationDeg: number
  readonly shadow: ViewerLookShadow | null
  readonly textures: readonly ViewerLookTexture[] | null
}

export type ViewerAutomation = {
  readonly status: RendererStatus['kind']
  readonly backend: RendererBackend | null
  // True while the store's status is ready, which the stage sets after the
  // first frame its observer saw actually rendered.
  readonly ready: boolean
  readonly failure: string | null
  // The product channel: the status kind, the slug it is about, the reason
  // when it failed, and the plain rig summary once it is ready. The rig
  // summary was computed once at parse time and rides with the store's
  // ready status; it is never recomputed per access.
  readonly product: ProductStatus['kind']
  readonly productSlug: string | null
  readonly productFailure: string | null
  readonly rig: ProductRigSummary | null
  // How many frames the stage's clock has recorded so far.
  readonly renderedFrames: number
  // The live tone mapping of the renderer, or null while there is none.
  readonly toneMapping: number | null
  // The product the stage has presented, or null while there is none.
  readonly model: ViewerModel | null
  // The applied look of the stage, or null while no product has applied one.
  readonly look: ViewerLook | null
}

export type ViewerAutomationSources = {
  // The renderer status exactly as the store holds it right now.
  readonly getStatus: () => RendererStatus
  // The product status exactly as the store holds it right now.
  readonly getProductStatus: () => ProductStatus
  readonly renderedFrames: () => number
  readonly getToneMapping: () => number | null
  // The applied look exactly as the renderer, the scene and the shadow
  // material hold it right now.
  readonly getLook: () => ViewerLook | null
}

export function createViewerAutomation(sources: ViewerAutomationSources): ViewerAutomation {
  const currentStatus = () => sources.getStatus()
  const currentProduct = () => sources.getProductStatus()
  return Object.freeze({
    get status(): RendererStatus['kind'] {
      return currentStatus().kind
    },
    get backend(): RendererBackend | null {
      return selectRendererBackend({ rendererStatus: currentStatus() })
    },
    get ready(): boolean {
      return currentStatus().kind === 'ready'
    },
    get failure(): string | null {
      const status = currentStatus()
      return status.kind === 'failed' ? status.reason : null
    },
    get product(): ProductStatus['kind'] {
      return currentProduct().kind
    },
    get productSlug(): string | null {
      const status = currentProduct()
      return status.kind === 'idle' ? null : status.slug
    },
    get productFailure(): string | null {
      const status = currentProduct()
      return status.kind === 'failed' ? status.reason : null
    },
    get rig(): ProductRigSummary | null {
      const status = currentProduct()
      return status.kind === 'ready' ? status.rig : null
    },
    get renderedFrames(): number {
      return sources.renderedFrames()
    },
    get toneMapping(): number | null {
      return sources.getToneMapping()
    },
    get look(): ViewerLook | null {
      return sources.getLook()
    },
    get model(): ViewerModel | null {
      const status = currentProduct()
      return status.kind === 'ready'
        ? { slug: status.slug, meshes: status.model.meshes, triangles: status.model.triangles }
        : null
    },
  })
}

declare global {
  interface Window {
    __viewer?: ViewerAutomation
  }
}
