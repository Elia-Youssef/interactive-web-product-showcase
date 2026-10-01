import { expect, test } from 'vitest'
import { harnessLook } from './harnessLook'

test('harnessLook: no parameter gives no override', () => {
  expect(harnessLook('?slug=sample-one')).toEqual({ kind: 'none' })
  expect(harnessLook('')).toEqual({ kind: 'none' })
  expect(harnessLook('?look=')).toEqual({ kind: 'none' })
})

test('harnessLook: a valid block parses through the manifest schema', () => {
  expect(harnessLook('?look=%7B%22exposure%22%3A2%7D')).toEqual({
    kind: 'override',
    look: { exposure: 2 },
  })
  expect(
    harnessLook('?look=%7B%22environmentRotationDeg%22%3A180%2C%22shadowOpacity%22%3A0%7D'),
  ).toEqual({
    kind: 'override',
    look: { environmentRotationDeg: 180, shadowOpacity: 0 },
  })
})

test('harnessLook: non-JSON text is a named invalid reason', () => {
  const look = harnessLook('?look=bright')
  expect(look.kind).toBe('invalid')
  if (look.kind === 'invalid') {
    expect(look.reason).toContain('not JSON')
  }
})

test('harnessLook: a field outside its bounds names the field', () => {
  const look = harnessLook('?look=%7B%22exposure%22%3A9%7D')
  expect(look.kind).toBe('invalid')
  if (look.kind === 'invalid') {
    expect(look.reason).toContain('exposure')
  }
})

test('harnessLook: an unknown key names the key', () => {
  const look = harnessLook('?look=%7B%22brightness%22%3A2%7D')
  expect(look.kind).toBe('invalid')
  if (look.kind === 'invalid') {
    expect(look.reason).toContain('brightness')
  }
})

test('harnessLook: a non-object parameter is invalid, not a crash', () => {
  const look = harnessLook('?look=4')
  expect(look.kind).toBe('invalid')
})
