import { execFile, type ExecFileOptions } from 'node:child_process'
import { promisify } from 'node:util'

// Real CLI cold starts and Meshopt work are CPU bound. Optimizer tests measured
// 4293 to 4712 ms alone under load, near Vitest's 5000 ms assertion timeout.
// Subprocess fixtures share the existing 30 second budget with their hooks.
export const SUBPROCESS_FIXTURE_TIMEOUT_MS = 30_000

const execFileAsync = promisify(execFile)

export function execFixtureFile(
  file: string,
  args: readonly string[],
  options: Omit<ExecFileOptions, 'timeout' | 'encoding'> = {},
) {
  return execFileAsync(file, [...args], {
    ...options,
    encoding: 'utf8',
    timeout: SUBPROCESS_FIXTURE_TIMEOUT_MS,
  })
}
