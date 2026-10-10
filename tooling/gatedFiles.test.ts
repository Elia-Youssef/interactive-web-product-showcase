// The gated file list over the real repo: the owned files without the ones
// the project does not author, and the one rule every gate reads its files
// through.
import { join } from 'node:path'
import { beforeAll, expect, test } from 'vitest'
import { isAuthoredFile, isGatedTextFile, listGatedFiles } from './gatedFiles.ts'
import { generatedFilePaths } from './generatedFiles.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { SUBPROCESS_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const repoRoot = join(import.meta.dirname, '..')
let owned: string[]
let gated: string[]
beforeAll(() => {
  owned = listOwnedFiles(repoRoot)
  gated = listGatedFiles(repoRoot)
}, SUBPROCESS_FIXTURE_TIMEOUT_MS)

test('sources are authored, generated files are not', () => {
  expect(isAuthoredFile('src/viewer/Stage.tsx')).toBe(true)
  expect(isAuthoredFile('public/models/sample-one/model.glb')).toBe(true)
  for (const generated of generatedFilePaths) {
    expect(isAuthoredFile(generated), generated).toBe(false)
  }
})

test('the gated list is the owned list without the files the project does not author', () => {
  expect(gated).toEqual(owned.filter(isAuthoredFile))
  for (const generated of generatedFilePaths) {
    expect(owned, generated).toContain(generated)
    expect(gated, generated).not.toContain(generated)
  }
})

test('text is decided by name: binary extensions and generated files are not gated text', () => {
  expect(isGatedTextFile('src/viewer/Stage.tsx')).toBe(true)
  expect(isGatedTextFile('public/_headers')).toBe(true)
  expect(isGatedTextFile('public/models/sample-one/model.glb')).toBe(false)
  expect(isGatedTextFile('public/fonts/face.woff2')).toBe(false)
  for (const generated of generatedFilePaths) {
    expect(isGatedTextFile(generated), generated).toBe(false)
  }
})
