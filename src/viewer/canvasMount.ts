import type { BackendRequestResult } from '@lib/renderer/request'

// Whether the stage can mount a canvas for the backend request. Only a valid
// request can: an invalid one has no backend to ask the renderer factory
// for, so the stage mounts no canvas and shows the renderer alert instead.
export function canMountCanvas(request: BackendRequestResult): boolean {
  return request.kind === 'valid'
}

// The environment file the stage's provider loads: the configured file when
// a canvas can mount, otherwise none. An environment only feeds a canvas, so
// a stage that mounts no canvas fetches no HDR.
export function stageEnvironmentFile(
  request: BackendRequestResult,
  configuredFile: string,
): string | null {
  return canMountCanvas(request) ? configuredFile : null
}
