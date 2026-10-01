// The runner of the raw design value gate: it scans every gated stylesheet
// and formats one line per finding. lint.ts calls it after ESLint in the
// same process, so one command reports both gates and fails on either.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findRawValues } from './styleRawValues.ts'
import type { RawValueFinding } from './styleRawValues.ts'
import { gatedStyleSheets } from './styleSheets.ts'
import { tokenSourcePath } from './tokenSource.ts'

export function scanGatedStyleSheets(root: string): RawValueFinding[] {
  return gatedStyleSheets(root).flatMap((file) =>
    findRawValues(file, readFileSync(join(root, file), 'utf8')),
  )
}

export function formatRawValueFindings(findings: readonly RawValueFinding[]): string {
  return findings
    .map(
      (finding) =>
        `${finding.path}:${finding.line}:${finding.column} ${finding.property}:` +
        ` raw ${finding.kind} ${finding.literal}, use a token from ${tokenSourcePath}`,
    )
    .join('\n')
}
