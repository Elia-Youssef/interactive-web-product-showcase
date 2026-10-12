// The control byte rule, as a pure core: a path and a text in, every ASCII
// control character that does not belong in a text source out, each with its
// position. Tab, line feed and carriage return are the only controls a text
// file may hold; a stray one (a raw NUL where an escape was meant) makes git
// treat the file as binary and hides it from diff-based review.
export type ControlByteFinding = {
  readonly path: string
  readonly line: number
  readonly column: number
  readonly code: number
}

const tab = 0x09
const lineFeed = 0x0a
const carriageReturn = 0x0d
const firstPrintable = 0x20
const deleteCode = 0x7f

export function isForbiddenControl(code: number): boolean {
  const isControl = code < firstPrintable || code === deleteCode
  return isControl && code !== tab && code !== lineFeed && code !== carriageReturn
}

// Lines split on line feed only, so a carriage return counts as one column
// and the numbers agree with the pointer gate's. Columns count UTF-16 units
// of the decoded text, from 1.
export function findControlBytes(path: string, text: string): ControlByteFinding[] {
  const findings: ControlByteFinding[] = []
  let line = 1
  let lineStart = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code === lineFeed) {
      line += 1
      lineStart = index + 1
    } else if (isForbiddenControl(code)) {
      findings.push({ path, line, column: index - lineStart + 1, code })
    }
  }
  return findings
}

export function formatControlByteFinding(finding: ControlByteFinding): string {
  const hex = finding.code.toString(16).toUpperCase().padStart(2, '0')
  return `${finding.path}:${finding.line}:${finding.column} control-byte: 0x${hex}`
}

export function formatControlByteFindings(findings: readonly ControlByteFinding[]): string {
  return findings.map(formatControlByteFinding).join('\n')
}
