import { expect, test } from 'vitest'
import { harnessSlug } from './harnessSlug'

test.each([
  { name: 'a plain slug parameter', query: '?slug=sample-one', expected: 'sample-one' },
  {
    name: 'a slug beside other parameters',
    query: '?backend=webgl&slug=sample-one',
    expected: 'sample-one',
  },
  { name: 'no parameter at all', query: '', expected: null },
  { name: 'an empty parameter', query: '?slug=', expected: null },
])('harnessSlug: $name', ({ query, expected }) => {
  expect(harnessSlug(query)).toBe(expected)
})
