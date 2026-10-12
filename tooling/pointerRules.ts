// The pointer rules, as a pure core: a path, a text, the local-only path
// entries and the owned file set in, every pointer to local-only material
// out, each with its position, kind and literal. No file system, so the
// tests plant strings. Every rule reports every hit, so a line holding
// several pointers yields every finding, never only the first.
import type { LocalOnlyEntry } from './localOnlyPaths.ts'

export type PointerKind =
  // A local-only file name or folder prefix at a path boundary
  | 'local-path'
  // The decision shorthand with its number
  | 'decision'
  // A work item label as a whole word
  | 'task-id'
  // A markdown reference that resolves to no owned file
  | 'markdown'

export type PointerFinding = {
  readonly path: string
  readonly line: number
  readonly column: number
  readonly kind: PointerKind
  readonly literal: string
}

export type PointerInput = {
  readonly path: string
  readonly text: string
  readonly localOnlyEntries: readonly LocalOnlyEntry[]
  readonly ownedFiles: ReadonlySet<string>
}

// A hit inside one line: the offset of its first character and the literal
// as written.
type LineHit = {
  readonly kind: PointerKind
  readonly literal: string
  readonly start: number
}

export function findPointerFindings(input: PointerInput): PointerFinding[] {
  const findings: PointerFinding[] = []
  input.text.split(/\r?\n/).forEach((line, index) => {
    for (const hit of lineHits(line, input)) {
      findings.push({
        path: input.path,
        line: index + 1,
        column: hit.start + 1,
        kind: hit.kind,
        literal: hit.literal,
      })
    }
  })
  return findings.sort(byPosition)
}

function lineHits(line: string, input: PointerInput): LineHit[] {
  return [
    ...localPathHits(line, input.localOnlyEntries),
    ...decisionHits(line),
    ...taskIdHits(line),
    ...markdownHits(line, input.path, input.ownedFiles),
  ]
}

// One scanner for the pattern rules: a fresh regex per call, so no shared
// lastIndex leaks between calls, and every match reported. A zero-width
// match would spin forever, so the scan steps over one.
function patternHits(line: string, pattern: RegExp, kind: PointerKind): LineHit[] {
  const hits: LineHit[] = []
  const scanner = new RegExp(pattern.source, pattern.flags)
  for (;;) {
    const match = scanner.exec(line)
    if (match === null) {
      return hits
    }
    hits.push({ kind, literal: match[0], start: match.index })
    if (match[0].length === 0) {
      scanner.lastIndex += 1
    }
  }
}

// A local-only entry counts at a path boundary: at the start of the line,
// after whitespace, a quote, a backtick or a parenthesis, or after an
// explicit relative step. Inside a longer path or a URL the entry is
// preceded by a name character or a bare slash, so it is only a fragment.
const boundaryCharacters = new Set(['"', "'", '`', '(', ')'])

function localPathHits(line: string, entries: readonly LocalOnlyEntry[]): LineHit[] {
  const hits: LineHit[] = []
  for (const entry of entries) {
    let from = 0
    for (;;) {
      const at = line.indexOf(entry.value, from)
      if (at === -1) {
        break
      }
      if (atPathBoundary(line, at) && endsOwnToken(entry, line, at)) {
        hits.push({ kind: 'local-path', literal: entry.value, start: at })
      }
      from = at + 1
    }
  }
  return hits
}

function atPathBoundary(line: string, at: number): boolean {
  if (at === 0) {
    return true
  }
  const previous = line[at - 1]
  if (previous === undefined) {
    return true
  }
  if (/\s/.test(previous) || boundaryCharacters.has(previous)) {
    return true
  }
  return previous === '/' && at >= 2 && line[at - 2] === '.'
}

// A file entry must also end its token: a name continuing into a longer one,
// such as a backup suffix, names a different file. A folder entry is a
// prefix by definition and keeps going.
const nameCharacters = /[A-Za-z0-9_.-]/

function endsOwnToken(entry: LocalOnlyEntry, line: string, at: number): boolean {
  if (entry.type === 'folder') {
    return true
  }
  const next = line[at + entry.value.length]
  return next === undefined || !nameCharacters.test(next)
}

// The decision shorthand: the word decision or decisions, either case, then
// a space and a number. Without the number it is an ordinary word.
const decisionPattern = /\bdecisions?[ \t]+\d+/gi

function decisionHits(line: string): LineHit[] {
  return patternHits(line, decisionPattern, 'decision')
}

// A work item label: a capital S, one or two digits, an optional dash
// with two more, as a whole word. The lookahead rejects a longer label, so
// an acronym with trailing letters and a three digit task stay clean.
const taskIdPattern = /\bS\d{1,2}(?:-\d{2})?(?![\w-])/g

function taskIdHits(line: string): LineHit[] {
  return patternHits(line, taskIdPattern, 'task-id')
}

// A markdown reference: a path-like token ending in the markdown extension.
// It counts when neither the repo root nor the referencing file's folder
// resolves it to an owned file, so the pointed-to file is local only or
// missing. A token that continues a protocol-relative address is a remote
// URL, not a repo path.
const markdownTokenPattern = /[A-Za-z0-9_./-]+/g
const markdownExtension = '.md'

function markdownHits(line: string, path: string, ownedFiles: ReadonlySet<string>): LineHit[] {
  const hits: LineHit[] = []
  for (const token of patternHits(line, markdownTokenPattern, 'markdown')) {
    const reference = token.literal.replace(/\.+$/, '')
    if (!isMarkdownReference(reference)) {
      continue
    }
    if (!resolvesToOwnedFile(reference, path, ownedFiles)) {
      hits.push({ kind: 'markdown', literal: reference, start: token.start })
    }
  }
  return hits
}

// A bare extension is no reference: the token needs a file name in front,
// and a leading double slash marks a remote address.
function isMarkdownReference(token: string): boolean {
  return (
    token.length > markdownExtension.length &&
    token.endsWith(markdownExtension) &&
    !token.startsWith('//')
  )
}

function resolvesToOwnedFile(
  reference: string,
  path: string,
  ownedFiles: ReadonlySet<string>,
): boolean {
  return resolveCandidates(reference, path).some((candidate) => ownedFiles.has(candidate))
}

// A reference resolves from the repo root and from the referencing file's
// folder, and either an owned file clears it. A repo absolute reference
// resolves from the root alone. Segments outside the root collapse to an
// empty path, which no owned file list contains.
function resolveCandidates(reference: string, path: string): string[] {
  if (reference.startsWith('/')) {
    return [normalizePath(reference)]
  }
  const folder = pathFolder(path)
  const candidates: string[] = []
  if (folder.length > 0) {
    candidates.push(normalizePath(`${folder}/${reference}`))
  }
  candidates.push(normalizePath(reference))
  return candidates
}

function pathFolder(path: string): string {
  const at = path.lastIndexOf('/')
  return at === -1 ? '' : path.slice(0, at)
}

function normalizePath(path: string): string {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

function byPosition(left: PointerFinding, right: PointerFinding): number {
  return left.line - right.line || left.column - right.column || left.kind.localeCompare(right.kind)
}
