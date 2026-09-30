import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { hasExtension, sourceExtensions, unitTestMarker } from './extensions.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { isUnderUnitTestRoot, unitTestGlobs } from './testRoots.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function isUnitTestFile(file: string): boolean {
  const baseName = file.slice(file.lastIndexOf('/') + 1)
  return hasExtension(file, sourceExtensions) && baseName.includes(`.${unitTestMarker}.`)
}

test('every owned unit test file lies under a root the test run includes', () => {
  const stray = listOwnedFiles(repoRoot)
    .filter(isUnitTestFile)
    .filter((file) => !isUnderUnitTestRoot(file))
  expect(stray).toEqual([])
})

test('the test run includes every root', () => {
  expect(unitTestGlobs()).toEqual([
    'src/**/*.test.{ts,tsx}',
    'tooling/**/*.test.{ts,tsx}',
    'tests/e2e/**/*.test.{ts,tsx}',
    'scripts/**/*.test.{ts,tsx}',
  ])
})
