// The control byte rule over planted strings, its report format, and the scan
// of a scratch repository. The gate over the real repository runs in the lint
// command, so no unit test repeats that scan. Control characters are built at
// runtime, so this file never holds one.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { scanGatedFilesForControlBytes } from './controlByteGate.ts'
import {
  findControlBytes,
  formatControlByteFinding,
  formatControlByteFindings,
  isForbiddenControl,
} from './controlBytes.ts'
import { generatedFilePaths } from './generatedFiles.ts'
import { execFixtureFile, TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const plantedPath = 'src/lib/planted.ts'
const allowedControls = [0x09, 0x0a, 0x0d]
const asciiCount = 128

function char(code: number): string {
  return String.fromCharCode(code)
}

describe('the control byte rule', () => {
  test('tab, line feed and carriage return are the only controls a text file may hold', () => {
    const text = ['a', char(0x09), 'b', char(0x0a), 'c', char(0x0d), char(0x0a), 'd'].join('')
    expect(findControlBytes(plantedPath, text)).toEqual([])
  })

  test('every other ASCII control character is forbidden, and no printable one is', () => {
    for (let code = 0; code < asciiCount; code += 1) {
      const isControl = code < 0x20 || code === 0x7f
      const expected = isControl && !allowedControls.includes(code)
      expect(isForbiddenControl(code), `0x${code.toString(16)}`).toBe(expected)
      const found = findControlBytes(plantedPath, `x${char(code)}y`).length
      expect(found, `0x${code.toString(16)}`).toBe(expected ? 1 : 0)
    }
  })

  test('text outside ASCII is not a control byte', () => {
    expect(findControlBytes(plantedPath, 'caf\u00e9 \u2192 \u0085 \u{1f600}')).toEqual([])
  })

  test('a finding carries its path, line, column and byte', () => {
    const text = ['first', '', `ab${char(0x00)}cd`].join(char(0x0a))
    expect(findControlBytes(plantedPath, text)).toEqual([
      { path: plantedPath, line: 3, column: 3, code: 0x00 },
    ])
  })

  test('every hit on a line is reported, in order, and CRLF lines count once', () => {
    const text = [`a${char(0x1b)}${char(0x7f)}`, `${char(0x01)}b`].join(char(0x0d) + char(0x0a))
    expect(findControlBytes(plantedPath, text)).toEqual([
      { path: plantedPath, line: 1, column: 2, code: 0x1b },
      { path: plantedPath, line: 1, column: 3, code: 0x7f },
      { path: plantedPath, line: 2, column: 1, code: 0x01 },
    ])
  })
})

describe('the control byte report', () => {
  test('a finding prints as path, line, column, kind and the byte in hex', () => {
    const [nul, escape] = findControlBytes(plantedPath, `ab${char(0x00)}\nc${char(0x1b)}`)
    expect(nul && formatControlByteFinding(nul)).toEqual(`${plantedPath}:1:3 control-byte: 0x00`)
    expect(escape && formatControlByteFinding(escape)).toEqual(
      `${plantedPath}:2:2 control-byte: 0x1B`,
    )
  })

  test('one line per finding', () => {
    const findings = findControlBytes(plantedPath, `${char(0x00)}${char(0x7f)}`)
    expect(formatControlByteFindings(findings).split('\n')).toEqual([
      `${plantedPath}:1:1 control-byte: 0x00`,
      `${plantedPath}:1:2 control-byte: 0x7F`,
    ])
  })
})

describe('the scan of the gated text files', () => {
  const scratchRoot = join(import.meta.dirname, '..', 'scratch')
  let repoRoot: string
  let lines: string[]

  beforeAll(async () => {
    mkdirSync(scratchRoot, { recursive: true })
    repoRoot = mkdtempSync(join(scratchRoot, 'control-scan-'))
    await execFixtureFile('git', ['init', '--quiet'], { cwd: repoRoot })
    writeFileSync(join(repoRoot, 'nul.ts'), `const a = 1\nconst b = \`x${char(0)}\`\n`)
    // A NUL as the very first byte is a text file's defect too, not a reason
    // to skip it as binary.
    writeFileSync(join(repoRoot, 'first.txt'), `${char(0)}text\n`)
    writeFileSync(join(repoRoot, 'escape.css'), `a {\n  color: red;${char(0x1b)}\n}\n`)
    writeFileSync(join(repoRoot, 'clean.ts'), `a${char(9)}b\r\nc${char(13)}d\n`)
    writeFileSync(join(repoRoot, 'planted.png'), Buffer.from([0, 0x1b, 0x7f, 1, 2]))
    for (const generated of generatedFilePaths) {
      writeFileSync(join(repoRoot, generated), `x${char(0)}\n`)
    }
    lines = formatControlByteFindings(scanGatedFilesForControlBytes(repoRoot)).split('\n')
  }, TOOL_FIXTURE_TIMEOUT_MS)

  afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test('forbidden bytes are found in text files, by name, and skipped in binary and generated ones', () => {
    expect(lines.sort()).toEqual([
      'escape.css:2:14 control-byte: 0x1B',
      'first.txt:1:1 control-byte: 0x00',
      'nul.ts:2:13 control-byte: 0x00',
    ])
  })
})
