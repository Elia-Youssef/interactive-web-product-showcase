import { describe, expect, test } from 'vitest'
import { siteCopy } from './site'

// The copy rules: ASCII only, no em dashes, one line per
// string, no stray whitespace. Every entry is checked, so a new string is
// covered the moment it is added.
const entries = Object.entries(siteCopy)

describe('site copy', () => {
  test.each(entries)('%s is ASCII, single-line and trimmed', (_key, text) => {
    expect(text).toMatch(/^[\x20-\x7e]+$/)
    expect(text).toBe(text.trim())
  })

  test.each(entries)('%s carries no em or en dash', (_key, text) => {
    expect(text).not.toMatch(/[\u2013\u2014]/)
  })
})
