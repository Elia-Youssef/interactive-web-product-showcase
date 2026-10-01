import net from 'node:net'
import { describe, expect, it } from 'vitest'
import { devHost, e2eBaseURL, e2eServer, isE2EServer } from './devHost.ts'

describe('devHost', () => {
  it('is the literal IPv4 loopback address, not a resolver name', () => {
    expect(net.isIP(devHost.address), 'the e2e host must be a literal IP address').toBe(4)
    expect(devHost.address.startsWith('127.'), 'the e2e host must be IPv4 loopback').toBe(true)
  })

  it('builds the base URL from that address and the given port', () => {
    expect(e2eBaseURL(5290)).toBe('http://127.0.0.1:5290')
    expect(e2eBaseURL(5292)).toBe('http://127.0.0.1:5292')
  })
})

describe('isE2EServer', () => {
  it('is false when the variable is unset, so a dev server by hand stays human', () => {
    expect(isE2EServer({})).toBe(false)
    expect(isE2EServer({ OTHER: e2eServer.value })).toBe(false)
  })

  it('is true only on the exact flag value', () => {
    expect(isE2EServer({ [e2eServer.variable]: e2eServer.value })).toBe(true)
  })

  it('rejects a set-but-wrong value instead of running the human configuration', () => {
    expect(() => isE2EServer({ [e2eServer.variable]: 'yes' })).toThrow(
      `only takes "${e2eServer.value}", but got "yes"`,
    )
    expect(() => isE2EServer({ [e2eServer.variable]: '' })).toThrow('but got ""')
  })
})
