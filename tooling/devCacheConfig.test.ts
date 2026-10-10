import { join } from 'node:path'
import { normalizePath, resolveConfig } from 'vite'
import { beforeAll, describe, expect, it } from 'vitest'
import { devCacheDir } from './devCacheDir.ts'
import { resolveDevPort } from './devPort.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const ROOT = join(import.meta.dirname, '..')

describe('the configured Vite cache directory', () => {
  let resolvedCacheDir: string | undefined

  beforeAll(async () => {
    const config = await resolveConfig(
      { root: ROOT, configFile: join(ROOT, 'vite.config.ts') },
      'serve',
    )
    resolvedCacheDir = config.cacheDir
  }, TOOL_FIXTURE_TIMEOUT_MS)

  it('keys the dependency cache to the dev port under the default cache root', () => {
    const expected = normalizePath(join(ROOT, devCacheDir(resolveDevPort(process.env))))
    expect(resolvedCacheDir).toBe(expected)
  })
})
