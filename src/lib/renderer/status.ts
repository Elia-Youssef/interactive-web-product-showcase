// The renderer's status, the domain's own shape of it: a union, not a flag
// pile, with exactly one of these kinds holding at any time. The store's
// renderer slice carries this type, and every reader of the status (the
// loading readout's rule among them) reaches it through here, so the one
// list of kinds has one owner.

import type { RendererBackend } from './backend'

export type RendererStatus =
  | { kind: 'initializing' }
  | { kind: 'ready'; backend: RendererBackend }
  | { kind: 'failed'; reason: string }
