// Tests for the shared validation-issue logic, moved with it from the
// product module so the behavior stays covered once, at the source.
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { formatFieldPath, issuesFromZod } from './validation'

describe('formatFieldPath', () => {
  it('joins object keys with dots', () => {
    expect(formatFieldPath(['camera', 'minDistance'])).toEqual('camera.minDistance')
  })

  it('wraps array positions in brackets', () => {
    expect(formatFieldPath(['hotspots', 1, 'bullets', 0])).toEqual('hotspots[1].bullets[0]')
  })

  it('renders an empty path as an empty string', () => {
    expect(formatFieldPath([])).toEqual('')
  })
})

describe('issuesFromZod', () => {
  it('maps a plain issue to its rendered path', () => {
    const schema = z.strictObject({ name: z.string() })
    const result = schema.safeParse({ name: 3 })
    if (result.success) {
      throw new Error('expected the parse to fail')
    }
    const issues = issuesFromZod(result.error.issues)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toBe('name')
    expect(issues[0]?.message).toBeTruthy()
  })

  it('expands unrecognized keys, one issue per key with the key on the path', () => {
    const schema = z.strictObject({ name: z.string() })
    const result = schema.safeParse({ name: 'a', nope: 1, nada: 2 })
    if (result.success) {
      throw new Error('expected the parse to fail')
    }
    expect(issuesFromZod(result.error.issues)).toEqual([
      { path: 'nope', message: 'unknown key' },
      { path: 'nada', message: 'unknown key' },
    ])
  })

  it('expands an unrecognized key on a nested object with its full path', () => {
    const schema = z.strictObject({ camera: z.strictObject({ min: z.number() }) })
    const result = schema.safeParse({ camera: { min: 1, nope: 1 } })
    if (result.success) {
      throw new Error('expected the parse to fail')
    }
    expect(issuesFromZod(result.error.issues)).toEqual([
      { path: 'camera.nope', message: 'unknown key' },
    ])
  })

  it('wraps array positions of a nested issue in brackets', () => {
    const schema = z.strictObject({ hotspots: z.array(z.strictObject({ id: z.string() })) })
    const result = schema.safeParse({ hotspots: [{ id: 3 }] })
    if (result.success) {
      throw new Error('expected the parse to fail')
    }
    const issues = issuesFromZod(result.error.issues)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toBe('hotspots[0].id')
  })
})
