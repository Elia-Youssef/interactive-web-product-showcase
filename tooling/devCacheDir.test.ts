import { describe, expect, it } from 'vitest'
import { devCacheDir, devCacheRoot } from './devCacheDir.ts'
import { devPort } from './devPort.ts'

describe('devCacheDir', () => {
  it('gives every port in the pool its own folder under the default cache root', () => {
    const folders = new Set<string>()
    for (let port = devPort.min; port <= devPort.max; port += 1) {
      const folder = devCacheDir(port)
      expect(folder.startsWith(`${devCacheRoot}/`), folder).toBe(true)
      expect(folders.has(folder), `port ${port} must own a folder no other port gets`).toBe(false)
      folders.add(folder)
    }
    expect(folders.size).toBe(devPort.max - devPort.min + 1)
  })

  it('returns the same folder for the same port', () => {
    expect(devCacheDir(5292)).toBe(devCacheDir(5292))
    expect(devCacheDir(devPort.default)).toBe(devCacheDir(devPort.default))
  })

  it('names the port that owns the folder', () => {
    expect(devCacheDir(5296)).toBe(`${devCacheRoot}/ports/5296`)
  })
})
