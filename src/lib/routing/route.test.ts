import { describe, expect, test } from 'vitest'
import { formatAppHref, formatProductPath, parseRoute } from './route'
import type { Route } from './route'

// The whole class of paths in one table: the three kinds, the trailing
// slash rule, the encoding rule, and the deeper or misshaped paths.
const cases: readonly {
  readonly pathname: string
  readonly expected: Route
}[] = [
  { pathname: '/', expected: { kind: 'root' } },
  {
    pathname: '/p/placeholder-speaker',
    expected: { kind: 'product', slug: 'placeholder-speaker' },
  },
  // The parse is shape-only: an unknown slug still parses as a product
  // route, and the collection's resolution decides it does not exist.
  { pathname: '/p/does-not-exist', expected: { kind: 'product', slug: 'does-not-exist' } },
  { pathname: '/p/', expected: { kind: 'unknown', path: '/p/' } },
  { pathname: '/p', expected: { kind: 'unknown', path: '/p' } },
  // The trailing slash rule: the canonical form has none, so this is an
  // unknown path, not a rewritten product route.
  {
    pathname: '/p/placeholder-speaker/',
    expected: { kind: 'unknown', path: '/p/placeholder-speaker/' },
  },
  { pathname: '/p/a/b', expected: { kind: 'unknown', path: '/p/a/b' } },
  { pathname: '/p//', expected: { kind: 'unknown', path: '/p//' } },
  // The encoding rule: the slug is the raw segment, never decoded, so an
  // encoded path parses to the encoded spelling.
  { pathname: '/p/%73peaker', expected: { kind: 'product', slug: '%73peaker' } },
  { pathname: '/p/a%20b', expected: { kind: 'product', slug: 'a%20b' } },
  { pathname: '/p/a+b', expected: { kind: 'product', slug: 'a+b' } },
  // Anything else is unknown, with the path carried for the report.
  { pathname: '/collection', expected: { kind: 'unknown', path: '/collection' } },
  {
    pathname: '/P/placeholder-speaker',
    expected: { kind: 'unknown', path: '/P/placeholder-speaker' },
  },
  {
    pathname: '/p/placeholder-speaker/extra',
    expected: { kind: 'unknown', path: '/p/placeholder-speaker/extra' },
  },
]

describe('parseRoute', () => {
  test.each(cases)('$pathname parses to the expected route', ({ pathname, expected }) => {
    expect(parseRoute(pathname)).toEqual(expected)
  })
})

describe('formatProductPath', () => {
  test('formats the canonical path of a slug with no trailing slash', () => {
    expect(formatProductPath('placeholder-speaker')).toBe('/p/placeholder-speaker')
  })

  test('encodes any string into one path segment', () => {
    expect(formatProductPath('a b/c')).toBe('/p/a%20b%2Fc')
  })

  test('round trips every schema-shaped slug through the parse', () => {
    const slugs = ['a', 'speaker', 'placeholder-speaker', '123', 'a-1-b-2']
    for (const slug of slugs) {
      const parsed = parseRoute(formatProductPath(slug))
      expect(parsed).toEqual({ kind: 'product', slug })
    }
  })
})

describe('formatAppHref', () => {
  test('carries the query string on the path', () => {
    expect(formatAppHref('/p/placeholder-speaker', '?backend=webgl')).toBe(
      '/p/placeholder-speaker?backend=webgl',
    )
  })

  test('formats the bare path when the query is empty', () => {
    expect(formatAppHref('/p/placeholder-speaker', '')).toBe('/p/placeholder-speaker')
  })

  test('carries the query on the root path too', () => {
    expect(formatAppHref('/', '?backend=webgl')).toBe('/?backend=webgl')
  })
})
