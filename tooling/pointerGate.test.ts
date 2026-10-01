// The pointer rules over the planted row table, the report format, the scan
// of a scratch repository with a binary file, and the gate over the real
// repo. Needles are assembled at runtime, so this file never holds one.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { runGit } from './gitCommand.ts'
import { formatPointerFindings, scanOwnedFilesForPointers } from './pointerGate.ts'
import { findPointerFindings } from './pointerRules.ts'
import type { PointerFinding } from './pointerRules.ts'
import { allPointerRows, plantedPath, taskIdNeedle } from './pointerRows.ts'

const repoRoot = join(import.meta.dirname, '..')

describe('the pointer rules', () => {
  for (const row of allPointerRows) {
    test(row.title, () => {
      const findings = findPointerFindings({
        path: row.path ?? plantedPath,
        text: row.text,
        localOnlyEntries: row.localOnlyEntries,
        ownedFiles: new Set(row.ownedFiles),
      })
      const expected: PointerFinding[] = row.expected.map((finding) => ({
        path: row.path ?? plantedPath,
        ...finding,
      }))
      expect(findings).toEqual(expected)
    })
  }
})

describe('the pointer gate over the real repo', () => {
  test('every owned file passes', () => {
    expect(scanOwnedFilesForPointers(repoRoot)).toEqual([])
  })
})

describe('the pointer gate report', () => {
  test('a finding prints as path, line, column, kind and literal', () => {
    const findings = findPointerFindings({
      path: plantedPath,
      text: ['shipped in ', taskIdNeedle, ' today'].join(''),
      localOnlyEntries: [],
      ownedFiles: new Set<string>(),
    })
    expect(formatPointerFindings(findings)).toEqual(`${plantedPath}:1:12 task-id: ${taskIdNeedle}`)
  })
})

describe('the scan of the owned files', () => {
  const scratchRoot = join(import.meta.dirname, '..', 'scratch')
  let repoRoot: string

  beforeAll(() => {
    mkdirSync(scratchRoot, { recursive: true })
    repoRoot = mkdtempSync(join(scratchRoot, 'pointer-scan-'))
    runGit(repoRoot, ['init', '--quiet'])
    const needleText = ['shipped in ', taskIdNeedle, ' today\n'].join('')
    writeFileSync(join(repoRoot, 'planted.txt'), needleText)
    writeFileSync(
      join(repoRoot, 'planted.bin'),
      Buffer.concat([Buffer.alloc(1, 0), Buffer.from(needleText, 'utf8')]),
    )
  }, 30_000)

  afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test('a pointer is found in a text file and skipped in a binary one', () => {
    const findings = scanOwnedFilesForPointers(repoRoot)
    expect(findings).toHaveLength(1)
    expect(findings[0]?.path).toEqual('planted.txt')
    expect(findings[0]?.line).toEqual(1)
    expect(findings[0]?.kind).toEqual('task-id')
  })
})
