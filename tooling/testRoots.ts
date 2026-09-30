// Where unit tests live. Vitest runs the unit test files under these roots,
// and a guard test fails when an owned unit test file sits anywhere else, so
// no test can silently fall outside the run. A new folder with tests is an
// edit here, nowhere else.
import { extensionGlob, sourceExtensions, unitTestMarker } from './extensions.ts'

export const unitTestRoots = ['src', 'tooling', 'tests/e2e', 'scripts'] as const

export function unitTestGlobs(): string[] {
  return unitTestRoots.map(
    (root) => `${root}/**/*.${unitTestMarker}.${extensionGlob(sourceExtensions)}`,
  )
}

// Paths are repo-relative with forward slashes, as git lists them.
export function isUnderUnitTestRoot(file: string): boolean {
  return unitTestRoots.some((root) => file.startsWith(`${root}/`))
}
