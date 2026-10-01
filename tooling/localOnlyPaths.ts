// The local-only path entries, parsed from the text of git's exclude file.
// The parser is pure: text in, entries out. Only the two anchored literal
// forms are kept, a file name and a folder prefix; every other line is
// ignored, because the gate matches literals, and a pattern entry could name
// paths it never matches literally.

export type LocalOnlyEntryType = 'file' | 'folder'

export type LocalOnlyEntry = {
  readonly type: LocalOnlyEntryType
  // A file entry is a bare file name; a folder entry keeps its trailing
  // slash, which is the prefix it matches
  readonly value: string
}

// The characters that make an exclude line a glob pattern. A line carrying
// any of them is no literal, so the gate ignores it whole.
const globCharacters = ['*', '?', '['] as const

export function parseLocalOnlyEntries(text: string): LocalOnlyEntry[] {
  const entries = new Map<string, LocalOnlyEntry>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    const skipped =
      line.length === 0 ||
      line.startsWith('#') ||
      line.startsWith('!') ||
      !line.startsWith('/') ||
      globCharacters.some((glyph) => line.includes(glyph))
    if (skipped) {
      continue
    }
    const entry = anchoredEntry(line)
    if (entry !== undefined) {
      entries.set(`${entry.type}:${entry.value}`, entry)
    }
  }
  return [...entries.values()]
}

// An anchored line is either a folder prefix, keeping its trailing slash, or
// a file name, which needs an extension in its last segment. Anything else
// names nothing the gate can match literally.
function anchoredEntry(line: string): LocalOnlyEntry | undefined {
  const value = line.slice(1)
  if (value.endsWith('/') && value.length > 1) {
    return { type: 'folder', value }
  }
  const lastSegment = value.slice(value.lastIndexOf('/') + 1)
  return lastSegment.includes('.') ? { type: 'file', value } : undefined
}
