import { expect, test } from 'vitest'
import { backendQueryParam, backendRequestValues, parseBackendRequest } from './request'

test('no backend parameter asks for automatic selection', () => {
  expect(parseBackendRequest('')).toEqual({ kind: 'valid', request: { kind: 'automatic' } })
  expect(parseBackendRequest('?other=value')).toEqual({
    kind: 'valid',
    request: { kind: 'automatic' },
  })
})

test.each(Object.entries(backendRequestValues))(
  'the allowed value "%s" asks for the request its table row defines',
  (value, entry) => {
    expect(parseBackendRequest(`?${backendQueryParam}=${value}`)).toEqual({
      kind: 'valid',
      request: entry.request,
    })
    expect(parseBackendRequest(`?product=x&${backendQueryParam}=${value}`)).toEqual({
      kind: 'valid',
      request: entry.request,
    })
  },
)

test.each([
  ['bogus', 'bogus'],
  ['webgl2', 'webgl2'],
  ['WEBGL', 'WEBGL'],
  [' webgl ', '%20webgl%20'],
  ['', ''],
])(
  'the invalid backend value "%s" fails loudly, naming parameter, value and the table of allowed values',
  (value, encoded) => {
    const result = parseBackendRequest(`?${backendQueryParam}=${encoded}`)

    expect(result.kind).toBe('invalid')
    if (result.kind !== 'invalid') {
      throw new Error('the result above must be invalid')
    }
    expect(result.reason).toContain(backendQueryParam)
    expect(result.reason).toContain(`"${value}"`)
    for (const allowed of Object.keys(backendRequestValues)) {
      expect(result.reason).toContain(allowed)
    }
    expect(result.reason).toContain('automatic selection')
  },
)

test.each([
  ['webgl', 'bogus'],
  ['webgl', 'webgl'],
  ['bogus', 'webgl'],
  ['', ''],
])('a repeated backend parameter ("%s", "%s") is invalid, whatever the values', (first, second) => {
  const result = parseBackendRequest(
    `?${backendQueryParam}=${first}&${backendQueryParam}=${second}`,
  )

  expect(result.kind).toBe('invalid')
  if (result.kind !== 'invalid') {
    throw new Error('the result above must be invalid')
  }
  expect(result.reason).toContain(backendQueryParam)
  expect(result.reason).toContain('given 2 times')
  expect(result.reason).toContain('At most one')
})
