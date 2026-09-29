// The missing-file check: only ENOENT counts as "not there", so no other
// error can hide behind the missing-file handling.
import { stat } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { isMissingFileError } from './fsErrors.ts'

describe('isMissingFileError', () => {
  it('accepts a real ENOENT from the filesystem', async () => {
    const error = await stat('definitely-missing-file.bin').catch((caught: unknown) => caught)
    expect(isMissingFileError(error)).toBe(true)
  })

  it('rejects a non-ENOENT node error', () => {
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' })
    expect(isMissingFileError(denied)).toBe(false)
  })

  it('rejects a plain error without a code', () => {
    expect(isMissingFileError(new Error('boom'))).toBe(false)
  })

  it('rejects anything that is not an error object', () => {
    expect(isMissingFileError(null)).toBe(false)
    expect(isMissingFileError('ENOENT')).toBe(false)
  })
})
