import { describe, expect, test } from 'vitest'
import {
  backendQueryParam,
  backendRequestValues,
  parseBackendRequest,
  type BackendRequestResult,
} from '@lib/renderer/request'
import { canMountCanvas, stageEnvironmentFile } from './canvasMount'

const environment = '/env/studio.hdr'

// Every outcome the stage can read from its URL: no parameter, each allowed
// value of the parameter (read from the allowed-values table, so a new value
// is covered without a row here) and the two ways a query is invalid.
const queries: ReadonlyArray<{ readonly name: string; readonly query: string }> = [
  { name: 'no parameter', query: '' },
  ...Object.keys(backendRequestValues).map((value) => ({
    name: `the allowed value '${value}'`,
    query: `?${backendQueryParam}=${value}`,
  })),
  { name: 'an unknown value', query: `?${backendQueryParam}=not-a-backend` },
  { name: 'a repeated parameter', query: `?${backendQueryParam}=webgl&${backendQueryParam}=webgl` },
]

// The decision per result kind, a record over the kinds so a new kind fails
// to compile here until it states whether it mounts a canvas.
const mountsCanvas: Record<BackendRequestResult['kind'], boolean> = {
  valid: true,
  invalid: false,
}

describe('the canvas gate and the environment it feeds', () => {
  test.each(queries)('$name', ({ query }) => {
    const request = parseBackendRequest(query)
    const mounts = mountsCanvas[request.kind]
    expect(canMountCanvas(request)).toBe(mounts)
    expect(stageEnvironmentFile(request, environment)).toBe(mounts ? environment : null)
  })

  test('the table reaches every kind of result', () => {
    const kinds = new Set(queries.map(({ query }) => parseBackendRequest(query).kind))
    expect([...kinds].sort()).toEqual(Object.keys(mountsCanvas).sort())
  })
})
