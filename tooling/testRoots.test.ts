import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, expect, test } from 'vitest'
import { hasExtension, sourceExtensions, unitTestMarker } from './extensions.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { isUnderUnitTestRoot, unitTestGlobs } from './testRoots.ts'
import { SUBPROCESS_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function isUnitTestFile(file: string): boolean {
  const baseName = file.slice(file.lastIndexOf('/') + 1)
  return hasExtension(file, sourceExtensions) && baseName.includes(`.${unitTestMarker}.`)
}

let stray: string[]
beforeAll(() => {
  stray = listOwnedFiles(repoRoot)
    .filter(isUnitTestFile)
    .filter((file) => !isUnderUnitTestRoot(file))
}, SUBPROCESS_FIXTURE_TIMEOUT_MS)

test('every owned unit test file lies under a root the test run includes', () => {
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
