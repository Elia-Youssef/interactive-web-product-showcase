// The one runner for every git call the gates and their tests make: the
// working tree root and the arguments in, the command's standard output out,
// any failure loud. Nothing else in tooling spawns a git process.
import { spawnSync } from 'node:child_process'

export function runGit(root: string, args: readonly string[]): string {
  const run = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (run.error !== undefined) {
    throw run.error
  }
  if (run.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed with status ${run.status}: ${run.stderr}`)
  }
  return run.stdout
}
