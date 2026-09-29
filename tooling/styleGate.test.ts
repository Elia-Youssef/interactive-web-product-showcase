// The stylesheet gate over the real repo: the list is the owned files
// filtered by the style extensions, and after the styles refactor the gate
// over every owned stylesheet reports nothing.

import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { hasExtension, styleExtensions } from './extensions.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { formatRawValueFindings, scanOwnedStyleSheets } from './styleGate.ts'
import { findRawValues } from './styleRawValues.ts'
import { ownedStyleSheets } from './styleSheets.ts'
import { tokenSourcePath } from './tokenSource.ts'

const repoRoot = join(import.meta.dirname, '..')

describe('the owned stylesheet list', () => {
  test('is the owned files filtered by the style extensions', () => {
    expect(ownedStyleSheets(repoRoot)).toEqual(
      listOwnedFiles(repoRoot).filter((file) => hasExtension(file, styleExtensions)),
    )
  })

  test('holds the token source and the global stylesheet', () => {
    const sheets = ownedStyleSheets(repoRoot)
    expect(sheets).toContain(tokenSourcePath)
    expect(sheets).toContain('src/styles/global.css')
  })
})

describe('the raw design value gate', () => {
  test('every owned stylesheet passes', () => {
    expect(scanOwnedStyleSheets(repoRoot)).toEqual([])
  })

  test('a finding names file, line, column, property, kind and literal', () => {
    const findings = findRawValues('src/ui/planted.module.css', '.a {\n  padding: 12px;\n}\n')
    expect(formatRawValueFindings(findings)).toEqual(
      `src/ui/planted.module.css:2:12 padding: raw length 12px, use a token from ${tokenSourcePath}`,
    )
  })
})
