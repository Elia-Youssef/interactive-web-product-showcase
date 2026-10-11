import { execFile, type ExecFileOptions } from 'node:child_process'
import { promisify } from 'node:util'

// CLI cold starts, Meshopt and in-process linting are CPU bound. Optimizer
// tests measured 4293 to 4712 ms alone under load; real harness linting took
// 6000 to 6800 ms, and JSX config resolution took 5168 ms alone. Heavy work
// belongs in setup with this shared budget, not the 5000 ms assertion budget.
// Real model fixture work uses this budget too: file reads, loader parses,
// codec round trips and cold facts derivation are CPU bound, whether they
// run in setup or are the behavior a case proves. A model fixture test
// reached 7672 ms in a full run; a cold hotspot derive reached 6713 ms.
export const TOOL_FIXTURE_TIMEOUT_MS = 30_000

const execFileAsync = promisify(execFile)

export function execFixtureFile(
  file: string,
  args: readonly string[],
  options: Omit<ExecFileOptions, 'timeout' | 'encoding'> = {},
) {
  return execFileAsync(file, [...args], {
    ...options,
    encoding: 'utf8',
    timeout: TOOL_FIXTURE_TIMEOUT_MS,
  })
}
