import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  extensionGlob,
  fixtureMarker,
  globAlternation,
  jsxExtensions,
  testFileGlob,
} from './extensions.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('globAlternation', () => {
  test('writes a single alternative bare, because a one-element brace is literal', () => {
    expect(globAlternation(['tsx'])).toBe('tsx')
  })

  test('writes several alternatives as a brace list', () => {
    expect(globAlternation(['ts', 'tsx'])).toBe('{ts,tsx}')
  })

  test('rejects an empty list instead of producing a pattern that matches nothing', () => {
    expect(() => globAlternation([])).toThrowError(/at least one alternative/)
  })

  test('backs both list-built globs', () => {
    expect(extensionGlob(['tsx'])).toBe('tsx')
    expect(testFileGlob(['test'], ['ts'])).toBe('**/*.test.ts')
  })

  test('builds the fixture glob from its marker, disjoint from the test markers', () => {
    expect(testFileGlob([fixtureMarker], ['ts'])).toBe('**/*.fixtures.ts')
    expect(testFileGlob([fixtureMarker], ['ts', 'tsx'])).toBe('**/*.fixtures.{ts,tsx}')
  })
})

describe('the JSX parsing block', () => {
  let config: Awaited<ReturnType<ESLint['calculateConfigForFile']>>
  beforeAll(async () => {
    const eslint = new ESLint({ cwd: repoRoot })
    config = await eslint.calculateConfigForFile(join(repoRoot, 'src/app/App.tsx'))
  }, TOOL_FIXTURE_TIMEOUT_MS)

  // The glob built from jsxExtensions must reach real .tsx files: a pattern
  // that matches nothing leaves the block silently dead.
  test('applies to a .tsx file in the resolved ESLint config', () => {
    expect(jsxExtensions).toContain('tsx')
    expect(config.languageOptions?.parserOptions?.ecmaFeatures?.jsx).toBe(true)
  })
})
