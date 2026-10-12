// The runner of the pointer gate: it scans every gated text file for
// pointers to local-only material and formats one line per finding. lint.ts
// calls it after the stylesheet gate in the same process, so one command
// reports all gates and fails on any of them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readLocalOnlyEntries } from './localOnlyReader.ts'
import { listGatedTextFiles } from './gatedFiles.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { findPointerFindings } from './pointerRules.ts'
import type { PointerFinding } from './pointerRules.ts'

// Every owned file is a valid reference target; only the gated text files
// are scanned.
export function scanGatedFilesForPointers(root: string): PointerFinding[] {
  const entries = readLocalOnlyEntries(root)
  const ownedFileSet = new Set(listOwnedFiles(root))
  return listGatedTextFiles(root).flatMap((file) =>
    findPointerFindings({
      path: file,
      text: readFileSync(join(root, file)).toString('utf8'),
      localOnlyEntries: entries,
      ownedFiles: ownedFileSet,
    }),
  )
}

export function formatPointerFindings(findings: readonly PointerFinding[]): string {
  return findings
    .map(
      (finding) =>
        `${finding.path}:${finding.line}:${finding.column} ${finding.kind}: ${finding.literal}`,
    )
    .join('\n')
}
