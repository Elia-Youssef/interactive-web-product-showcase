// The thin reader of the local-only path entries: it asks git where the
// exclude file lives, which resolves the same way in a plain checkout and in
// a worktree, and hands its text to the pure parser. A checkout whose
// exclude file is missing or empty yields no entries, and the gate keeps its
// remaining rules.
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { runGit } from './gitCommand.ts'
import { parseLocalOnlyEntries } from './localOnlyPaths.ts'
import type { LocalOnlyEntry } from './localOnlyPaths.ts'

export function readLocalOnlyEntries(root: string): LocalOnlyEntry[] {
  const reported = runGit(root, ['rev-parse', '--git-path', 'info/exclude']).trim()
  if (reported.length === 0) {
    return []
  }
  const excludePath = isAbsolute(reported) ? reported : resolve(root, reported)
  if (!existsSync(excludePath)) {
    return []
  }
  return parseLocalOnlyEntries(readFileSync(excludePath, 'utf8'))
}
