import { describe, expect, it } from 'vitest'
import {
  KTX_BIN_ENV_VAR,
  KTX_VERSION_MIN,
  KtxError,
  defaultKtxFolder,
  envDelimiter,
  findKtxOnPath,
  formatKtxVersion,
  isKtxVersionAtLeast,
  parseKtxVersion,
  putKtxFolderOnPath,
  resolveKtxSoftware,
  type KtxDeps,
  type KtxResolution,
} from './ktxSoftware.ts'

const VERSION_MIN_TEXT = formatKtxVersion(KTX_VERSION_MIN)

function resolutionIn(folder: string, source: KtxResolution['source']): KtxResolution {
  return { folder, source, version: KTX_VERSION_MIN }
}

function depsWith(overrides: Partial<KtxDeps>): KtxDeps {
  return {
    env: {},
    platform: 'win32',
    folderExists: () => false,
    findOnPath: () => null,
    readVersion: async () => `ktx version: v4.4.2~1a2b3c`,
    ...overrides,
  }
}

describe('parseKtxVersion', () => {
  it('parses the real version output with the v prefix and build hash', () => {
    expect(parseKtxVersion('ktx version: v4.4.2~1a2b3c')).toEqual({ major: 4, minor: 4, patch: 2 })
  })

  it('parses output without prefix or hash', () => {
    expect(parseKtxVersion('ktx version: 4.4.0')).toEqual({ major: 4, minor: 4, patch: 0 })
    expect(parseKtxVersion('4.5.1')).toEqual({ major: 4, minor: 5, patch: 1 })
  })

  it('returns null for unparsable or empty output', () => {
    expect(parseKtxVersion('')).toBeNull()
    expect(parseKtxVersion('ktx: command not found')).toBeNull()
  })
})

describe('isKtxVersionAtLeast', () => {
  it('accepts the minimum and any newer version', () => {
    expect(isKtxVersionAtLeast({ major: 4, minor: 4, patch: 0 }, KTX_VERSION_MIN)).toBe(true)
    expect(isKtxVersionAtLeast({ major: 4, minor: 4, patch: 2 }, KTX_VERSION_MIN)).toBe(true)
    expect(isKtxVersionAtLeast({ major: 4, minor: 5, patch: 0 }, KTX_VERSION_MIN)).toBe(true)
    expect(isKtxVersionAtLeast({ major: 5, minor: 0, patch: 0 }, KTX_VERSION_MIN)).toBe(true)
  })

  it('rejects anything older', () => {
    expect(isKtxVersionAtLeast({ major: 4, minor: 3, patch: 9 }, KTX_VERSION_MIN)).toBe(false)
    expect(isKtxVersionAtLeast({ major: 3, minor: 9, patch: 9 }, KTX_VERSION_MIN)).toBe(false)
  })
})

describe('envDelimiter', () => {
  it('separates PATH entries with the platform separator', () => {
    expect(envDelimiter('win32')).toBe(';')
    expect(envDelimiter('linux')).toBe(':')
    expect(envDelimiter('darwin')).toBe(':')
  })
})

describe('defaultKtxFolder', () => {
  it('names the Windows install folder and nothing elsewhere', () => {
    expect(defaultKtxFolder('win32')).toContain('KTX-Software')
    expect(defaultKtxFolder('linux')).toBeNull()
  })
})

describe('findKtxOnPath', () => {
  const win32 = 'win32' as const
  const folders = new Set(['C:\\Tools\\ktx', 'C:\\Windows'])

  it('returns the first PATH folder that holds ktx', () => {
    const found = findKtxOnPath({ PATH: 'C:\\Windows;C:\\Tools\\ktx' }, win32, (folder) =>
      folders.has(folder),
    )
    expect(found).toBe('C:\\Windows')
  })

  it('skips empty entries and returns null when nothing matches', () => {
    const nothingHolds = (folder: string): boolean => folders.has(folder)
    expect(findKtxOnPath({ PATH: ';C:\\nowhere;;' }, win32, nothingHolds)).toBeNull()
    expect(findKtxOnPath({}, win32, () => true)).toBeNull()
  })
})

describe('resolveKtxSoftware', () => {
  it('prefers the documented environment variable', async () => {
    const resolution = await resolveKtxSoftware(
      depsWith({
        env: { [KTX_BIN_ENV_VAR]: 'D:\\KTX\\bin' },
        folderExists: (folder) => folder === 'D:\\KTX\\bin',
      }),
    )
    expect(resolution.folder).toBe('D:\\KTX\\bin')
    expect(resolution.source).toBe('env')
    expect(resolution.version).toEqual({ major: 4, minor: 4, patch: 2 })
  })

  it('fails naming the variable when the env folder is unusable', async () => {
    await expect(
      resolveKtxSoftware(depsWith({ env: { [KTX_BIN_ENV_VAR]: 'D:\\missing' } })),
    ).rejects.toThrow(KtxError)
    await expect(
      resolveKtxSoftware(depsWith({ env: { [KTX_BIN_ENV_VAR]: 'D:\\missing' } })),
    ).rejects.toThrow(KTX_BIN_ENV_VAR)
  })

  it('falls back to the PATH when the variable is unset', async () => {
    const resolution = await resolveKtxSoftware(
      depsWith({
        findOnPath: () => 'C:\\Tools\\ktx',
        folderExists: (folder) => folder === 'C:\\Tools\\ktx',
      }),
    )
    expect(resolution.folder).toBe('C:\\Tools\\ktx')
    expect(resolution.source).toBe('path')
  })

  it('falls back to the platform default folder last', async () => {
    const resolution = await resolveKtxSoftware(
      depsWith({ folderExists: (folder) => folder === defaultKtxFolder('win32') }),
    )
    expect(resolution.source).toBe('default')
    expect(resolution.folder).toBe(defaultKtxFolder('win32'))
  })

  it('fails naming the variable when nothing resolves', async () => {
    await expect(resolveKtxSoftware(depsWith({ platform: 'linux' }))).rejects.toThrow(
      new RegExp(`Set ${KTX_BIN_ENV_VAR}`),
    )
  })

  it('fails naming the version found when the install is too old', async () => {
    const error = await resolveKtxSoftware(
      depsWith({
        env: { [KTX_BIN_ENV_VAR]: 'D:\\old-ktx' },
        folderExists: () => true,
        readVersion: async () => 'ktx version: v4.3.1~deadbeef',
      }),
    ).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(KtxError)
    expect((error as KtxError).message).toContain('4.3.1')
    expect((error as KtxError).message).toContain(`needs ${VERSION_MIN_TEXT}`)
  })

  it('fails on version output it cannot parse', async () => {
    await expect(
      resolveKtxSoftware(
        depsWith({
          env: { [KTX_BIN_ENV_VAR]: 'D:\\broken-ktx' },
          folderExists: () => true,
          readVersion: async () => 'no version here',
        }),
      ),
    ).rejects.toThrow(/printed no version/)
  })
})

describe('putKtxFolderOnPath', () => {
  const KTX_FOLDER = 'C:\\Program Files\\KTX-Software\\bin'

  it('prepends the resolved folder to this process PATH only', () => {
    const env: Record<string, string | undefined> = { PATH: 'C:\\Windows' }
    putKtxFolderOnPath(resolutionIn(KTX_FOLDER, 'default'), env, 'win32')
    expect(env.PATH).toBe(`${KTX_FOLDER};C:\\Windows`)
  })

  it('joins entries with the delimiter of the platform it is given', () => {
    const env: Record<string, string | undefined> = { PATH: 'C:\\Windows' }
    putKtxFolderOnPath(resolutionIn('C:\\ktx', 'env'), env, 'linux')
    expect(env.PATH).toBe('C:\\ktx:C:\\Windows')
  })

  it('is idempotent when the folder is already on PATH', () => {
    const env: Record<string, string | undefined> = { PATH: `${KTX_FOLDER};C:\\Windows` }
    putKtxFolderOnPath(resolutionIn(KTX_FOLDER, 'path'), env, 'win32')
    expect(env.PATH).toBe(`${KTX_FOLDER};C:\\Windows`)
  })

  it('works on an empty PATH', () => {
    const env: Record<string, string | undefined> = {}
    putKtxFolderOnPath(resolutionIn('C:\\ktx', 'env'), env, 'win32')
    expect(env.PATH).toBe('C:\\ktx')
  })
})
