import type { RendererBackend } from '@lib/renderer/backend'
import { selectRendererBackend, type RendererStatus } from '@store/index'

// The test contract of the viewer, installed as window.__viewer in every
// build. Every field is a getter: status, backend, ready and failure are
// read from the store at access time, and the frame field from the stage's
// frame clock, so the hook holds no copies that can go stale.

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
  readonly renderedFrames: () => number
  readonly getToneMapping: () => number | null
  readonly getModel: () => ViewerModel | null
}

export function createViewerAutomation(sources: ViewerAutomationSources): ViewerAutomation {
  const currentStatus = () => sources.getStatus()
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
