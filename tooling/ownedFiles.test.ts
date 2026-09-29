// Proves the owned-file list against a real scratch repository: a tracked
// file deleted on disk must drop out of the list, while its tracked and
// untracked neighbors stay. This is the case that crashed the lint and format
// gates with "No files matching" and ENOENT.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listOwnedFiles } from './ownedFiles.ts'

const scratchRoot = join(import.meta.dirname, '..', 'scratch')

function git(root: string, args: readonly string[]): void {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (run.error !== undefined) {
    throw run.error
  }
  if (run.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed with status ${run.status}: ${run.stderr}`)
  }
}

describe('listOwnedFiles', () => {
  let repoRoot: string

  beforeAll(() => {
    mkdirSync(scratchRoot, { recursive: true })
    repoRoot = mkdtempSync(join(scratchRoot, 'owned-files-'))
    git(repoRoot, ['init', '--quiet'])
    writeFileSync(join(repoRoot, 'kept.ts'), 'export const planted = 1\n')
    writeFileSync(join(repoRoot, 'deleted.ts'), 'export const planted = 2\n')
    git(repoRoot, ['add', 'kept.ts', 'deleted.ts'])
    git(repoRoot, [
      '-c',
      'user.name=planted',
      '-c',
      'user.email=planted@example.com',
      'commit',
      '--quiet',
      '-m',
      'plant',
    ])
    rmSync(join(repoRoot, 'deleted.ts'))
    writeFileSync(join(repoRoot, 'untracked.ts'), 'export const planted = 3\n')
  }, 30_000)

  afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  it('drops tracked files deleted on disk and keeps the rest', () => {
    expect(listOwnedFiles(repoRoot).sort()).toEqual(['kept.ts', 'untracked.ts'])
  })
})
