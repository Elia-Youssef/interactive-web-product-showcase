// Proves the owned-file list against a real scratch repository: a tracked
// file deleted on disk must drop out of the list, while its tracked and
// untracked neighbors stay. This is the case that crashed the lint and format
// gates with "No files matching" and ENOENT.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listOwnedFiles } from './ownedFiles.ts'
import { execFixtureFile, SUBPROCESS_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const scratchRoot = join(import.meta.dirname, '..', 'scratch')

describe('listOwnedFiles', () => {
  let repoRoot: string
  let owned: string[]

  beforeAll(async () => {
    mkdirSync(scratchRoot, { recursive: true })
    repoRoot = mkdtempSync(join(scratchRoot, 'owned-files-'))
    await execFixtureFile('git', ['init', '--quiet'], { cwd: repoRoot })
    writeFileSync(join(repoRoot, 'kept.ts'), 'export const planted = 1\n')
    writeFileSync(join(repoRoot, 'deleted.ts'), 'export const planted = 2\n')
    await execFixtureFile('git', ['add', 'kept.ts', 'deleted.ts'], { cwd: repoRoot })
    await execFixtureFile(
      'git',
      [
        '-c',
        'user.name=planted',
        '-c',
        'user.email=planted@example.com',
        'commit',
        '--quiet',
        '-m',
        'plant',
      ],
      { cwd: repoRoot },
    )
    rmSync(join(repoRoot, 'deleted.ts'))
    writeFileSync(join(repoRoot, 'untracked.ts'), 'export const planted = 3\n')
    owned = listOwnedFiles(repoRoot).sort()
  }, SUBPROCESS_FIXTURE_TIMEOUT_MS)

  afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  it('drops tracked files deleted on disk and keeps the rest', () => {
    expect(owned).toEqual(['kept.ts', 'untracked.ts'])
  })
})
