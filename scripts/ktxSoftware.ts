// Resolves the KTX-Software folder that holds the `ktx` command and
// verifies its version, so the encode stage can spawn `ktx` by absolute
// path from the verified install.
//
// The search order is fixed: the documented environment variable first, so
// a machine with a custom install wins; then the process PATH; then the
// platform's default install folder. An environment variable that is set
// but unusable is an error, never a silent fallback: the operator chose
// that folder on purpose.
import path from 'node:path'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

// Documented in scripts/optimize.ts.
export const KTX_BIN_ENV_VAR = 'KTX_SOFTWARE_BIN'

// gltf-transform 4.5.1 needs KTX-Software 4.4.0 or newer.
export const KTX_VERSION_MIN: KtxVersion = { major: 4, minor: 4, patch: 0 }

export type KtxVersion = {
  major: number
  minor: number
  patch: number
}

export type KtxSource = 'env' | 'path' | 'default'

export type KtxResolution = {
  folder: string
  version: KtxVersion
  source: KtxSource
}

// The environment and platform shape of Node's process, narrowed to what
// resolution reads, so tests can inject plain objects.
export type ProcessEnvLike = Record<string, string | undefined>

// Everything resolution needs from the outside world. The real bounds live
// in defaultKtxDeps; tests inject the rest.
export type KtxDeps = {
  env: ProcessEnvLike
  platform: NodeJS.Platform
  folderExists: (folder: string) => boolean
  findOnPath: (env: ProcessEnvLike, platform: NodeJS.Platform) => string | null
  readVersion: (folder: string) => Promise<string>
}

export class KtxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KtxError'
  }
}

export function ktxExecutableName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'ktx.exe' : 'ktx'
}

// The absolute path of the ktx command inside a resolved install folder.
export function ktxExecutablePath(folder: string, platform: NodeJS.Platform): string {
  return path.join(folder, ktxExecutableName(platform))
}

// PATH entries are separated by ';' on Windows and ':' elsewhere. Derived
// from the injected platform, never from the running process, so the
// resolution tests stay honest on any machine.
export function envDelimiter(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : ':'
}

// The documented default install folder. Windows ships an installer that
// creates it; other platforms have no default and must set the variable.
export function defaultKtxFolder(platform: NodeJS.Platform): string | null {
  if (platform === 'win32') {
    return path.join('C:', 'Program Files', 'KTX-Software', 'bin')
  }
  return null
}

// Walks PATH and returns the first folder that holds the ktx executable.
// The existence check is injectable, so the walk is testable without a
// filesystem.
export function findKtxOnPath(
  env: ProcessEnvLike,
  platform: NodeJS.Platform,
  folderExists: (folder: string) => boolean,
): string | null {
  const pathText = env.PATH ?? ''
  const delimiter = envDelimiter(platform)
  for (const entry of pathText.split(delimiter)) {
    if (entry === '') {
      continue
    }
    if (folderExists(entry)) {
      return entry
    }
  }
  return null
}

// Parses `ktx version: v4.4.2~1a2b3c` into its numeric triple. Returns null
// for anything unparsable, so the caller can fail with the raw text.
export function parseKtxVersion(output: string): KtxVersion | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(output)
  if (match === null) {
    return null
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null
  }
  return { major, minor, patch }
}

export function isKtxVersionAtLeast(version: KtxVersion, min: KtxVersion): boolean {
  if (version.major !== min.major) {
    return version.major > min.major
  }
  if (version.minor !== min.minor) {
    return version.minor > min.minor
  }
  return version.patch >= min.patch
}

// Renders a version triple the way `ktx --version` prints it.
export function formatKtxVersion(version: KtxVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

// Resolves and verifies the KTX-Software install. Fails loudly, naming the
// environment variable, the folder tried and the version found.
export async function resolveKtxSoftware(deps: KtxDeps): Promise<KtxResolution> {
  const fromEnv = deps.env[KTX_BIN_ENV_VAR]
  if (fromEnv !== undefined && fromEnv !== '') {
    return verify(deps, fromEnv, 'env')
  }
  const onPath = deps.findOnPath(deps.env, deps.platform)
  if (onPath !== null) {
    return verify(deps, onPath, 'path')
  }
  const fallback = defaultKtxFolder(deps.platform)
  if (fallback !== null) {
    return verify(deps, fallback, 'default')
  }
  throw new KtxError(
    `Could not find KTX-Software. Set ${KTX_BIN_ENV_VAR} to the folder that holds the ktx command.`,
  )
}

async function verify(deps: KtxDeps, folder: string, source: KtxSource): Promise<KtxResolution> {
  if (!deps.folderExists(folder)) {
    const message =
      `${describeSource(source)} is '${folder}', but the folder does not exist or holds no ktx command. ` +
      `Set ${KTX_BIN_ENV_VAR} or install KTX-Software ${formatKtxVersion(KTX_VERSION_MIN)} or newer.`
    throw new KtxError(message)
  }
  const versionText = await deps.readVersion(folder)
  const version = parseKtxVersion(versionText)
  if (version === null) {
    const message =
      `${describeSource(source)} is '${folder}', ` +
      `but 'ktx --version' printed no version: ${JSON.stringify(versionText)}`
    throw new KtxError(message)
  }
  if (!isKtxVersionAtLeast(version, KTX_VERSION_MIN)) {
    const message =
      `${describeSource(source)} is '${folder}', but KTX-Software ${formatKtxVersion(version)} is too old: ` +
      `gltf-transform needs ${formatKtxVersion(KTX_VERSION_MIN)} or newer. ` +
      `Point ${KTX_BIN_ENV_VAR} at a newer install.`
    throw new KtxError(message)
  }
  return { folder, version, source }
}

function describeSource(source: KtxSource): string {
  switch (source) {
    case 'env':
      return `The folder from ${KTX_BIN_ENV_VAR}`
    case 'path':
      return 'The folder of the ktx command on PATH'
    case 'default':
      return 'The default KTX-Software folder'
  }
}

function folderHoldsKtx(folder: string, platform: NodeJS.Platform): boolean {
  return existsSync(ktxExecutablePath(folder, platform))
}

// The real deps against the current process.
export function defaultKtxDeps(env: ProcessEnvLike = process.env): KtxDeps {
  return {
    env,
    platform: process.platform,
    folderExists: (folder) => folderHoldsKtx(folder, process.platform),
    findOnPath: (loopEnv, platform) =>
      findKtxOnPath(loopEnv, platform, (folder) => folderHoldsKtx(folder, platform)),
    readVersion: (folder) =>
      new Promise<string>((resolve, reject) => {
        execFile(
          ktxExecutablePath(folder, process.platform),
          ['--version'],
          { encoding: 'utf8' },
          (error, stdout, stderr) => {
            if (error !== null && stdout === '' && stderr === '') {
              reject(new KtxError(`Failed to run 'ktx --version' in '${folder}': ${error.message}`))
              return
            }
            resolve(`${stdout}${stderr}`)
          },
        )
      }),
  }
}

// Runs one ktx command from the resolved install and fails loudly on a
// nonzero exit or a spawn failure, with the command and both streams in the
// error. The absolute executable path is passed, so the encode stage never
// depends on the process PATH.
export async function runKtxCommand(
  ktxPath: string,
  args: readonly string[],
  options: { timeout?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  const command = args[0] ?? ''
  const [exitCode, stdout, stderr] = await new Promise<[number | null, string, string]>(
    (resolve, reject) => {
      execFile(
        ktxPath,
        [...args],
        { ...options, encoding: 'utf8' },
        (error, stdoutText, stderrText) => {
          if (error === null) {
            resolve([0, stdoutText, stderrText])
            return
          }
          if (typeof error.code === 'string') {
            reject(
              new KtxError(`Failed to run 'ktx ${command}' from '${ktxPath}': ${error.message}`),
            )
            return
          }
          resolve([typeof error.code === 'number' ? error.code : null, stdoutText, stderrText])
        },
      )
    },
  )
  if (exitCode !== 0) {
    const output = `${stdout}\n${stderr}`.trim()
    throw new KtxError(`ktx ${command} failed with exit code ${exitCode ?? 'signal'}:\n${output}`)
  }
  return { stdout, stderr }
}

// One call for the runner: resolve and verify the install before any
// encode runs, so a missing or too-old ktx fails before work starts.
export async function prepareKtxSoftware(
  env: ProcessEnvLike = process.env,
): Promise<KtxResolution> {
  const deps = defaultKtxDeps(env)
  return resolveKtxSoftware(deps)
}
