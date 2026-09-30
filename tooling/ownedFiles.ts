// The owned-file list. Git is the single ignore authority: what git tracks or
// sees as a fresh untracked file is ours to lint and format, and what any
// ignore source hides is not. There is no second, hand-kept list.
import { spawnSync } from 'node:child_process'

function gitLines(root: string, args: readonly string[]): string[] {
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
  return run.stdout.split('\0').filter((file) => file.length > 0)
}

// Every file this checkout owns: tracked files plus untracked files no ignore
// source hides. A tracked file deleted on disk is subtracted again, so a
// delete or move in the editor cannot hand the gates a path that no longer
// exists. In a worktree .git is a file, which git itself resolves.
export function listOwnedFiles(root: string): string[] {
  const listed = gitLines(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
  const deleted = new Set(gitLines(root, ['ls-files', '-z', '--deleted']))
  return listed.filter((file) => !deleted.has(file))
}
