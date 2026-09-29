// The backend request as data: what a URL asks the renderer factory to do.
// The parameter name and its allowed values live here, so the URL contract,
// the parser, the failure reasons and the test matrix share one definition.

// The URL query parameter that selects a rendering backend.
export const backendQueryParam = 'backend'

// The parameter value that forces the WebGL2 fallback instead of the
// automatic WebGPU-first selection.
export const backendForceWebGLValue = 'webgl'

// What a valid request asks for: automatic selection (three tries WebGPU
// first and falls back on its own), or the forced WebGL2 fallback.
export type BackendRequest = { kind: 'automatic' } | { kind: 'forced-webgl2' }

// One row of the allowed-values table: the request the value asks for and
// the words the invalid reason uses to describe it.
export type BackendRequestValue = {
  readonly request: BackendRequest
  readonly description: string
}

// The allowed values of the backend parameter, defined once. The parser
// accepts exactly these, and the invalid reason lists exactly these, so a
// new value is one row here and nothing else.
export const backendRequestValues: Readonly<Record<string, BackendRequestValue>> = {
  [backendForceWebGLValue]: {
    request: { kind: 'forced-webgl2' },
    description: 'forces the WebGL2 fallback',
  },
}

function allowedValuesSentence(): string {
  const rows = Object.entries(backendRequestValues).map(
    ([value, entry]) => `'${value}' ${entry.description}`,
  )
  return `${rows.join(', ')}, or no parameter for automatic selection`
}

function invalidReason(value: string): string {
  return `Invalid '${backendQueryParam}' parameter: "${value}". Allowed values: ${allowedValuesSentence()}.`
}

function duplicateReason(count: number): string {
  return (
    `Invalid '${backendQueryParam}' parameter: given ${count} times. ` + 'At most one is allowed.'
  )
}

// The outcome of parsing: a valid request, or a reason naming the parameter,
// the rejected value (or the repeated parameter) and the allowed values.
export type BackendRequestResult =
  { kind: 'valid'; request: BackendRequest } | { kind: 'invalid'; reason: string }

// Parses the query part of a URL (window.location.search, empty included)
// into a backend request. An unknown value, or more than one backend
// parameter, is invalid and fails loudly; the caller decides how the failure
// reaches the user.
export function parseBackendRequest(query: string): BackendRequestResult {
  const values = new URLSearchParams(query).getAll(backendQueryParam)
  if (values.length > 1) {
    return { kind: 'invalid', reason: duplicateReason(values.length) }
  }
  const value = values[0]
  if (value === undefined) {
    return { kind: 'valid', request: { kind: 'automatic' } }
  }
  const known = backendRequestValues[value]
  if (known !== undefined) {
    return { kind: 'valid', request: known.request }
  }
  return { kind: 'invalid', reason: invalidReason(value) }
}
