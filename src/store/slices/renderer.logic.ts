import type { RendererBackend } from '@lib/renderer/backend'
import type { RendererStatus } from '@lib/renderer/status'

// The renderer status is the domain's own union, owned beside the backend
// it names; the slice carries it and owns its transitions.
export type { RendererStatus }

export type RendererEvent =
  | { kind: 'ready'; backend: RendererBackend }
  | { kind: 'failed'; reason: string }
  | { kind: 'reset' }

export const initialRendererStatus: RendererStatus = { kind: 'initializing' }

// Pure transition from (status, event) to the next status. A failed status
// stays failed on later ready or failed events on purpose: the first cause
// is the one worth showing. Only a reset, a fresh mount, leaves it.
export function applyRendererEvent(status: RendererStatus, event: RendererEvent): RendererStatus {
  switch (event.kind) {
    case 'ready':
      return status.kind === 'failed' ? status : { kind: 'ready', backend: event.backend }
    case 'failed':
      return status.kind === 'failed' ? status : { kind: 'failed', reason: event.reason }
    case 'reset':
      return initialRendererStatus
  }
}
