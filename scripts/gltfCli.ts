// Drives the installed gltf-transform CLI as a child process. The CLI, not
// the scripting API, runs the tested optimize code paths, and it brings
// its own texture encoder and animation resampler, so no further packages
// are needed. Every stage is one `node <bin> <args>` spawn: no shell, no
// quoting, and arguments pass through verbatim.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export class GltfCliError extends Error {
  readonly command: string
  readonly exitCode: number | null

  constructor(command: string, exitCode: number | null, output: string) {
    super(
      `gltf-transform ${command} failed with exit code ${exitCode ?? 'signal'}:\n${output.trim()}`,
    )
    this.name = 'GltfCliError'
    this.command = command
    this.exitCode = exitCode
  }
}
// Resolves the CLI's bin script from the installed package. The package
// entry lives in dist/, so the bin is always its sibling: <pkg>/bin/cli.js.
export function gltfCliBinPath(entryUrl: string): string {
  const binUrl = new URL('../bin/cli.js', entryUrl)
  return fileURLToPath(binUrl)
}

// The resolved bin path of the installed CLI. Resolution walks the package
// entry to its sibling bin script; it is pure lookup, so callers resolve
// per run and no module state is kept.
export function resolveGltfCliBin(): string {
  return gltfCliBinPath(import.meta.resolve('@gltf-transform/cli'))
}

export type CliOutput = {
  stdout: string
  stderr: string
}

// Runs one gltf-transform command and fails loudly on a nonzero exit. The
// CLI logs its progress on stdout and its errors on stderr; both come back
// so a failure carries the full report.
export async function runGltfCli(
  binPath: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<CliOutput> {
  const command = args[0] ?? ''
  const child = spawn(process.execPath, [binPath, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })
  // Both streams drain concurrently, so neither pipe can fill and stall the
  // child while the other is still being read.
  const [stdout, stderr] = await Promise.all([readStream(child.stdout), readStream(child.stderr)])
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  if (exitCode !== 0) {
    throw new GltfCliError(command, exitCode, `${stdout}\n${stderr}`)
  }
  return { stdout, stderr }
}

async function readStream(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (stream === null) {
    return ''
  }
  let text = ''
  stream.setEncoding('utf8')
  for await (const chunk of stream) {
    text += chunk
  }
  return text
}
