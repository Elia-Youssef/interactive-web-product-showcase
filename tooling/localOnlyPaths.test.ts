// The exclude parser over planted texts, and the reader against a real
// scratch repository. Planted entries are assembled from parts, so no whole
// local-only path appears in this file: the gate scans its own test sources.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFixtureFile, TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'
import { parseLocalOnlyEntries } from './localOnlyPaths.ts'
import type { LocalOnlyEntry } from './localOnlyPaths.ts'
import { readLocalOnlyEntries } from './localOnlyReader.ts'

// Planted exclude lines, assembled so this file never holds a whole entry.
const folderLine = ['/', 'planted', '-folder/'].join('')
const fileLine = ['/', 'planted', '-file', '.ext'].join('')
const globLine = ['/', 'planted', '*', '.log'].join('')
const negatedLine = ['!', folderLine].join('')
const unanchoredFolderLine = folderLine.slice(1)
const commentLine = ['# ', 'planted comment'].join('')

const folderEntry: LocalOnlyEntry = { type: 'folder', value: folderLine.slice(1) }
const fileEntry: LocalOnlyEntry = { type: 'file', value: fileLine.slice(1) }

type ParseRow = {
  readonly title: string
  readonly text: string
  readonly expected: readonly LocalOnlyEntry[]
}

const parseRows: readonly ParseRow[] = [
  {
    title: 'comments and blank lines are skipped',
    text: [commentLine, '', folderLine, ''].join('\n'),
    expected: [folderEntry],
  },
  {
    title: 'negated lines are skipped',
    text: [negatedLine, fileLine].join('\n'),
    expected: [fileEntry],
  },
  {
    title: 'glob lines are skipped',
    text: [globLine, folderLine].join('\n'),
    expected: [folderEntry],
  },
  {
    title: 'unanchored lines are skipped',
    text: [unanchoredFolderLine, fileLine.slice(1), folderLine, fileLine].join('\n'),
    expected: [folderEntry, fileEntry],
  },
  {
    title: 'an anchored line that is neither form is ignored',
    text: [['/', 'planted'].join(''), ['/', 'a', '.', 'b', '/planted'].join(''), folderLine].join(
      '\n',
    ),
    expected: [folderEntry],
  },
  {
    title: 'a folder entry keeps its nested prefix',
    text: [['/', 'planted', '/deep/'].join(''), fileLine].join('\n'),
    expected: [{ type: 'folder', value: ['planted', '/deep/'].join('') }, fileEntry],
  },
  {
    title: 'Windows line endings are handled',
    text: [folderLine, fileLine, ''].join('\r\n'),
    expected: [folderEntry, fileEntry],
  },
  {
    title: 'a repeated entry is reported once',
    text: [folderLine, folderLine].join('\n'),
    expected: [folderEntry],
  },
]

describe('parseLocalOnlyEntries', () => {
  for (const row of parseRows) {
    it(row.title, () => {
      expect(parseLocalOnlyEntries(row.text)).toEqual(row.expected)
    })
  }
})

describe('readLocalOnlyEntries', () => {
  const scratchRoot = join(import.meta.dirname, '..', 'scratch')
  let repoRoot: string
  let empty: LocalOnlyEntry[]
  let parsed: LocalOnlyEntry[]
  const planted = [folderLine, commentLine, fileLine].join('\n')

  beforeAll(async () => {
    mkdirSync(scratchRoot, { recursive: true })
    repoRoot = mkdtempSync(join(scratchRoot, 'local-only-'))
    await execFixtureFile('git', ['init', '--quiet'], { cwd: repoRoot })
    empty = readLocalOnlyEntries(repoRoot)
    writeFileSync(join(repoRoot, '.git', 'info', 'exclude'), planted)
    parsed = readLocalOnlyEntries(repoRoot)
  }, TOOL_FIXTURE_TIMEOUT_MS)

  afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  it('yields no entries for a checkout without exclude entries', () => {
    expect(empty).toEqual([])
  })

  it('reads the exclude file through the pure parser', () => {
    expect(parsed).toEqual(parseLocalOnlyEntries(planted))
    expect(parsed).toEqual([folderEntry, fileEntry])
  })
})
