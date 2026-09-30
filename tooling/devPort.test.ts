import { describe, expect, it } from 'vitest'
import { devPort, resolveDevPort } from './devPort.ts'

describe('resolveDevPort', () => {
  it('returns the pool default 5290 when the variable is unset', () => {
    expect(resolveDevPort({})).toBe(5290)
    expect(devPort.default, 'the default must stay inside the pool').toBeGreaterThanOrEqual(
      devPort.min,
    )
    expect(devPort.default).toBeLessThanOrEqual(devPort.max)
  })

  it('accepts every port in the allowed range', () => {
    for (let port = devPort.min; port <= devPort.max; port += 1) {
      expect(resolveDevPort({ [devPort.variable]: String(port) })).toBe(port)
    }
  })

  it('rejects values below and above the range', () => {
    expect(() => resolveDevPort({ [devPort.variable]: String(devPort.min - 1) })).toThrow(
      `must be an integer from ${devPort.min} to ${devPort.max}`,
    )
    expect(() => resolveDevPort({ [devPort.variable]: String(devPort.max + 1) })).toThrow(
      `must be an integer from ${devPort.min} to ${devPort.max}`,
    )
  })

  it('rejects the Vite default port 5173', () => {
    expect(() => resolveDevPort({ [devPort.variable]: '5173' })).toThrow('but got "5173"')
  })

  it('rejects non-integer values', () => {
    expect(() => resolveDevPort({ [devPort.variable]: '5290.5' })).toThrow('but got "5290.5"')
    expect(() => resolveDevPort({ [devPort.variable]: 'vite' })).toThrow('but got "vite"')
  })

  it('rejects values that are digits only in appearance', () => {
    // Number() would accept each of these: the shape check must not.
    expect(() => resolveDevPort({ [devPort.variable]: ' 5291 ' })).toThrow('but got " 5291 "')
    expect(() => resolveDevPort({ [devPort.variable]: '0x14AB' })).toThrow('but got "0x14AB"')
    expect(() => resolveDevPort({ [devPort.variable]: '5.291e3' })).toThrow('but got "5.291e3"')
    expect(() => resolveDevPort({ [devPort.variable]: '5291.0' })).toThrow('but got "5291.0"')
  })

  it('rejects an empty value instead of falling back to the default', () => {
    expect(() => resolveDevPort({ [devPort.variable]: '' })).toThrow('but got ""')
  })
})
