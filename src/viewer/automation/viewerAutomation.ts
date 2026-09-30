import type { ProductRigSummary } from '@lib/product'
import type { RendererBackend } from '@lib/renderer/backend'
import { selectRendererBackend, type ProductStatus, type RendererStatus } from '@store/index'

// The test contract of the viewer, installed as window.__viewer in every
// build. Every field is a getter: the renderer fields are read from the
// store at access time, the product fields the same way, and the frame
// field from the stage's frame clock, so the hook holds no copies that can
// go stale.

// The model a stage has loaded, exactly as the automation hook reports it.
// The counts come from the loaded scene, computed once on load.
export type ViewerModel = {
  readonly slug: string
  readonly meshes: number
  readonly triangles: number
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
  // The model in the stage's scene, or null until one is in it.
  readonly model: ViewerModel | null
}

export type ViewerAutomationSources = {
  // The renderer status exactly as the store holds it right now.
  readonly getStatus: () => RendererStatus
  // The product status exactly as the store holds it right now.
  readonly getProductStatus: () => ProductStatus
  readonly renderedFrames: () => number
  readonly getToneMapping: () => number | null
  readonly getModel: () => ViewerModel | null
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
    get model(): ViewerModel | null {
      return sources.getModel()
    },
  })
}

declare global {
  interface Window {
    __viewer?: ViewerAutomation
  }
}
