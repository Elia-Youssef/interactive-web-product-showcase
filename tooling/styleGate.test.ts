// The stylesheet gate over the real repo: the list is the owned files
// filtered by the style extensions, and after the styles refactor the gate
// over every owned stylesheet reports nothing.

import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { hasExtension, styleExtensions } from './extensions.ts'
import { listGatedFiles } from './gatedFiles.ts'
import { formatRawValueFindings, scanGatedStyleSheets } from './styleGate.ts'
import { findRawValues } from './styleRawValues.ts'
import { gatedStyleSheets } from './styleSheets.ts'
import { tokenSourcePath } from './tokenSource.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const repoRoot = join(import.meta.dirname, '..')
let sheets: string[]
let gated: string[]
let findings: ReturnType<typeof scanGatedStyleSheets>
beforeAll(() => {
  sheets = gatedStyleSheets(repoRoot)
  gated = listGatedFiles(repoRoot)
  findings = scanGatedStyleSheets(repoRoot)
}, TOOL_FIXTURE_TIMEOUT_MS)

describe('the owned stylesheet list', () => {
  test('is the owned files filtered by the style extensions', () => {
    expect(sheets).toEqual(gated.filter((file) => hasExtension(file, styleExtensions)))
  })

  test('holds the token source and the global stylesheet', () => {
    expect(sheets).toContain(tokenSourcePath)
    expect(sheets).toContain('src/styles/global.css')
  })
})

describe('the raw design value gate', () => {
  test('every owned stylesheet passes', () => {
    expect(findings).toEqual([])
  })

  test('a finding names file, line, column, property, kind and literal', () => {
    const findings = findRawValues('src/ui/planted.module.css', '.a {\n  padding: 12px;\n}\n')
    expect(formatRawValueFindings(findings)).toEqual(
      `src/ui/planted.module.css:2:12 padding: raw length 12px, use a token from ${tokenSourcePath}`,
    )
  })
})
