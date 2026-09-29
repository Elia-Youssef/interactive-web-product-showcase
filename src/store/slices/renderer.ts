import type { RendererBackend } from '@lib/renderer/backend'
import {
  applyRendererEvent,
  initialRendererStatus,
  type RendererEvent,
  type RendererStatus,
} from './renderer.logic'

export type { RendererStatus } from './renderer.logic'

export type RendererSliceState = {
  rendererStatus: RendererStatus
}

export type RendererSlice = RendererSliceState & {
  rendererReady: (backend: RendererBackend) => void
  rendererFailed: (reason: string) => void
  rendererReset: () => void
}

// The slice only ever writes its own fields, so it asks for a set narrowed
// to its own state. The full store's set satisfies this structurally.
type SetRendererState = (
  updater: (state: RendererSliceState) => Partial<RendererSliceState>,
) => void

export function createRendererSlice(set: SetRendererState): RendererSlice {
  const apply = (event: RendererEvent) => {
    set((state) => ({ rendererStatus: applyRendererEvent(state.rendererStatus, event) }))
  }

  return {
    rendererStatus: initialRendererStatus,
    rendererReady: (backend) => apply({ kind: 'ready', backend }),
    rendererFailed: (reason) => apply({ kind: 'failed', reason }),
    rendererReset: () => apply({ kind: 'reset' }),
  }
}

export function selectRendererStatus(state: RendererSliceState): RendererStatus {
  return state.rendererStatus
}

export function selectRendererBackend(state: RendererSliceState): RendererBackend | null {
  switch (state.rendererStatus.kind) {
    case 'ready':
      return state.rendererStatus.backend
    case 'initializing':
    case 'failed':
      return null
  }
}
