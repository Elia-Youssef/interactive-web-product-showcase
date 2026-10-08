// The gated file list over the real repo: the owned files without the ones
// the project does not author, and the one rule every gate reads its files
// through.
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { isAuthoredFile, listGatedFiles } from './gatedFiles.ts'
import { generatedFilePaths } from './generatedFiles.ts'
import { listOwnedFiles } from './ownedFiles.ts'

const repoRoot = join(import.meta.dirname, '..')

test('sources are authored, generated files are not', () => {
  expect(isAuthoredFile('src/viewer/Stage.tsx')).toBe(true)
  expect(isAuthoredFile('public/models/sample-one/model.glb')).toBe(true)
  for (const generated of generatedFilePaths) {
    expect(isAuthoredFile(generated), generated).toBe(false)
  }
})

test('the gated list is the owned list without the files the project does not author', () => {
  const owned = listOwnedFiles(repoRoot)
  const gated = listGatedFiles(repoRoot)

  expect(gated).toEqual(owned.filter(isAuthoredFile))
  for (const generated of generatedFilePaths) {
    expect(owned, generated).toContain(generated)
    expect(gated, generated).not.toContain(generated)
  }
})
