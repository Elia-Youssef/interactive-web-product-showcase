import { parseBackendRequest, type BackendRequestResult } from '@lib/renderer/request'

// The one module that touches window.location. Everything downstream works
// on the parsed result, so the URL contract stays testable without a page.
export function backendRequestFromLocation(): BackendRequestResult {
  return parseBackendRequest(window.location.search)
}
