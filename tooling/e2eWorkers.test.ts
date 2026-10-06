import { describe, expect, it } from 'vitest'
import { e2eWorkers, resolveE2EWorkers } from './e2eWorkers.ts'

describe('resolveE2EWorkers', () => {
  it('returns the default 6 when the variable is unset', () => {
    expect(resolveE2EWorkers({})).toBe(6)
    expect(e2eWorkers.default, 'the default must stay inside the range').toBeGreaterThanOrEqual(
      e2eWorkers.min,
    )
    expect(e2eWorkers.default).toBeLessThanOrEqual(e2eWorkers.max)
  })

  it('accepts every worker count in the allowed range', () => {
    for (let workers = e2eWorkers.min; workers <= e2eWorkers.max; workers += 1) {
      expect(resolveE2EWorkers({ [e2eWorkers.variable]: String(workers) })).toBe(workers)
    }
  })

  it('rejects values below and above the range', () => {
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: String(e2eWorkers.min - 1) })).toThrow(
      `must be an integer from ${e2eWorkers.min} to ${e2eWorkers.max}`,
    )
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: String(e2eWorkers.max + 1) })).toThrow(
      `must be an integer from ${e2eWorkers.min} to ${e2eWorkers.max}`,
    )
  })

  it('names the variable, the range and the raw value in the error', () => {
    expect(() => resolveE2EWorkers({ VIEWER_E2E_WORKERS: '9' })).toThrow(
      'VIEWER_E2E_WORKERS must be an integer from 1 to 6, but got "9"',
    )
  })

  it('rejects non-integer values', () => {
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: '2.0' })).toThrow('but got "2.0"')
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: '-1' })).toThrow('but got "-1"')
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: 'two' })).toThrow('but got "two"')
  })

  it('rejects values that are digits only in appearance', () => {
    // Number() would accept each of these: the shape check must not.
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: ' 2' })).toThrow('but got " 2"')
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: '0x2' })).toThrow('but got "0x2"')
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: '2e0' })).toThrow('but got "2e0"')
  })

  it('rejects an empty value instead of falling back to the default', () => {
    expect(() => resolveE2EWorkers({ [e2eWorkers.variable]: '' })).toThrow('but got ""')
  })
})
