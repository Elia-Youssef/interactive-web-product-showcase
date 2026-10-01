// The owned-file list. Git is the single ignore authority: what git tracks or
// sees as a fresh untracked file is ours to lint and format, and what any
// ignore source hides is not. There is no second, hand-kept list.
import { runGit } from './gitCommand.ts'

function gitLines(root: string, args: readonly string[]): string[] {
  return runGit(root, args)
    .split('\0')
    .filter((file) => file.length > 0)
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
