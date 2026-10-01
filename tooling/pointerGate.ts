// The runner of the pointer gate: it scans every gated text file for
// pointers to local-only material and formats one line per finding. lint.ts
// calls it after the stylesheet gate in the same process, so one command
// reports all gates and fails on any of them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readLocalOnlyEntries } from './localOnlyReader.ts'
import { isAuthoredFile } from './gatedFiles.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { findPointerFindings } from './pointerRules.ts'
import type { PointerFinding } from './pointerRules.ts'

// Git's own binary rule: a file whose first bytes hold a NUL byte is binary,
// and no text rule reads it.
const binaryProbeLength = 8000

// Every owned file, a vendored one included, is a valid reference target;
// only the files the project authors are scanned, by the gated-file rule.
export function scanGatedFilesForPointers(root: string): PointerFinding[] {
  const entries = readLocalOnlyEntries(root)
  const ownedFiles = listOwnedFiles(root)
  const ownedFileSet = new Set(ownedFiles)
  return ownedFiles.filter(isAuthoredFile).flatMap((file) => {
    const bytes = readFileSync(join(root, file))
    if (isBinary(bytes)) {
      return []
    }
    return findPointerFindings({
      path: file,
      text: bytes.toString('utf8'),
      localOnlyEntries: entries,
      ownedFiles: ownedFileSet,
    })
  })
}

function isBinary(bytes: Buffer): boolean {
  return bytes.subarray(0, binaryProbeLength).includes(0)
}

export function formatPointerFindings(findings: readonly PointerFinding[]): string {
  return findings
    .map(
      (finding) =>
        `${finding.path}:${finding.line}:${finding.column} ${finding.kind}: ${finding.literal}`,
    )
    .join('\n')
}
