import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  duplicateOutputsMessage,
  findDuplicateOutputs,
  readOutputFiles,
  type OutputFile,
} from './outputDuplicateGuard.ts'

const encoder = new TextEncoder()

function file(path: string, text: string): OutputFile {
  return { path, bytes: encoder.encode(text) }
}

describe('findDuplicateOutputs', () => {
  test('a hashed emission and a public copy of the same bytes are one group', () => {
    const files = [
      file('index.html', '<script src="/assets/index-A1.js"></script>'),
      file('assets/basis_transcoder-X1.wasm', 'wasm bytes'),
      file('basis/basis_transcoder.wasm', 'wasm bytes'),
      file('assets/basis_transcoder-Y2.js', 'js glue'),
      file('basis/basis_transcoder.js', 'js glue'),
    ]
    expect(findDuplicateOutputs(files)).toEqual([
      ['assets/basis_transcoder-X1.wasm', 'basis/basis_transcoder.wasm'],
      ['assets/basis_transcoder-Y2.js', 'basis/basis_transcoder.js'],
    ])
  })

  test('every copy of a payload shipped three times is named', () => {
    const files = [file('a.bin', 'same'), file('b/b.bin', 'same'), file('c/c/c.bin', 'same')]
    expect(findDuplicateOutputs(files)).toEqual([['a.bin', 'b/b.bin', 'c/c/c.bin']])
  })

  test('files that only share a size or a name are no finding', () => {
    const files = [file('a/model.glb', 'abcd'), file('b/model.glb', 'abce')]
    expect(findDuplicateOutputs(files)).toEqual([])
  })

  test('empty files duplicate no payload', () => {
    const files = [
      file('brand/.gitkeep', ''),
      file('env/.gitkeep', ''),
      file('models/.gitkeep', ''),
    ]
    expect(findDuplicateOutputs(files)).toEqual([])
  })
})

describe('readOutputFiles', () => {
  const scratchRoot = join(import.meta.dirname, '..', 'scratch')
  let outDir: string

  beforeAll(() => {
    mkdirSync(scratchRoot, { recursive: true })
    outDir = mkdtempSync(join(scratchRoot, 'output-duplicates-'))
    mkdirSync(join(outDir, 'assets'))
    mkdirSync(join(outDir, 'basis'))
    writeFileSync(join(outDir, 'index.html'), '<html></html>')
    writeFileSync(join(outDir, 'assets', 'basis_transcoder-X1.wasm'), 'wasm bytes')
    writeFileSync(join(outDir, 'basis', 'basis_transcoder.wasm'), 'wasm bytes')
  })

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true })
  })

  test('reads every nested file with its forward-slash path', () => {
    const paths = readOutputFiles(outDir)
      .map((entry) => entry.path)
      .sort()
    expect(paths).toEqual([
      'assets/basis_transcoder-X1.wasm',
      'basis/basis_transcoder.wasm',
      'index.html',
    ])
  })

  test('a written public copy beside a hashed emission is found on disk', () => {
    expect(findDuplicateOutputs(readOutputFiles(outDir))).toEqual([
      ['assets/basis_transcoder-X1.wasm', 'basis/basis_transcoder.wasm'],
    ])
  })
})

test('the failure names every copy of each payload', () => {
  expect(duplicateOutputsMessage([['a.wasm', 'b.wasm']])).toBe(
    'the build output ships the same bytes more than once:\n  a.wasm = b.wasm',
  )
})
