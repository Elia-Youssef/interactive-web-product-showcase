import { describe, expect, test } from 'vitest'
import {
  classicThreeModuleIds,
  judgeUndefinedImport,
  readUndefinedImport,
  UNREACHABLE_UNDEFINED_IMPORTS,
} from './threeBuildGuard.ts'

const WEBGPU_MODULES = [
  'E:/repo/node_modules/three/build/three.webgpu.js',
  'E:/repo/node_modules/three/build/three.core.js',
  'E:/repo/node_modules/three/build/three.tsl.js',
]

describe('classicThreeModuleIds', () => {
  test('a module graph holding the classic three build names it', () => {
    expect(
      classicThreeModuleIds([
        ...WEBGPU_MODULES,
        'E:/repo/node_modules/three/build/three.module.js',
      ]),
    ).toEqual(['E:/repo/node_modules/three/build/three.module.js'])
  })

  test('the classic three build is named wherever the package manager laid it out', () => {
    expect(
      classicThreeModuleIds([
        'E:/repo/node_modules/.pnpm/three@0.186.1/node_modules/three/build/three.module.js',
      ]),
    ).toEqual(['E:/repo/node_modules/.pnpm/three@0.186.1/node_modules/three/build/three.module.js'])
  })

  test('windows path separators are normalized before matching', () => {
    expect(
      classicThreeModuleIds(['E:\\repo\\node_modules\\three\\build\\three.module.js']),
    ).toEqual(['E:/repo/node_modules/three/build/three.module.js'])
  })

  test('the one webgpu build with its core and node system is no finding', () => {
    expect(classicThreeModuleIds(WEBGPU_MODULES)).toEqual([])
  })

  test('an app module that merely imports three is no finding by itself', () => {
    expect(classicThreeModuleIds(['E:/repo/src/viewer/config.ts'])).toEqual([])
  })
})

const ESC = String.fromCharCode(27)
const WEBGPU_EXPORTER = 'node_modules/.pnpm/three@0.186.1/node_modules/three/build/three.webgpu.js'
const FIBER_MODULE =
  'E:/repo/node_modules/.pnpm/@react-three+fiber@9.8.1/node_modules/@react-three/fiber/dist/events.esm.js'

// The bundler's warning as it reports it, colour codes included.
function undefinedImportLog(binding: string, exporter: string, importer: string) {
  return {
    code: 'IMPORT_IS_UNDEFINED',
    message: `${ESC}[33m[IMPORT_IS_UNDEFINED] ${ESC}[0mImport \`${binding}\` will always be undefined because there is no matching export in '${exporter}'\n  ${importer}:1:1`,
    id: importer,
  }
}

describe('readUndefinedImport', () => {
  test('reads the binding, the exporter and the importer through the colour codes', () => {
    expect(
      readUndefinedImport(undefinedImportLog('WebGLRenderer', WEBGPU_EXPORTER, FIBER_MODULE)),
    ).toEqual({ binding: 'WebGLRenderer', exporter: WEBGPU_EXPORTER, importer: FIBER_MODULE })
  })

  test('another log is no undefined import', () => {
    expect(readUndefinedImport({ code: 'CIRCULAR_DEPENDENCY', message: 'a -> b -> a' })).toBeNull()
  })

  test('an undefined import the guard cannot read fails loudly', () => {
    expect(() =>
      readUndefinedImport({ code: 'IMPORT_IS_UNDEFINED', message: 'a reworded warning', id: 'x' }),
    ).toThrow('cannot read this undefined import')
  })
})

describe('judgeUndefinedImport', () => {
  test('a classic-only name an app module reads from three is a finding', () => {
    expect(
      judgeUndefinedImport({
        binding: 'WebGLRenderer',
        exporter: WEBGPU_EXPORTER,
        importer: 'E:/repo/src/viewer/StageCanvas.tsx',
      }),
    ).toBe('finding')
  })

  test('a classic-only name another package reads from three is a finding', () => {
    expect(
      judgeUndefinedImport({
        binding: 'WebGLRenderTarget',
        exporter: WEBGPU_EXPORTER,
        importer: 'E:/repo/node_modules/camera-controls/dist/camera-controls.module.js',
      }),
    ).toBe('finding')
  })

  test("a declared package's other undefined reads are findings", () => {
    expect(
      judgeUndefinedImport({
        binding: 'WebGLCubeRenderTarget',
        exporter: WEBGPU_EXPORTER,
        importer: FIBER_MODULE,
      }),
    ).toBe('finding')
  })

  test("R3F's default renderer branch is the declared unreachable read", () => {
    expect(
      judgeUndefinedImport({
        binding: 'WebGLRenderer',
        exporter: WEBGPU_EXPORTER,
        importer: FIBER_MODULE,
      }),
    ).toBe('declared')
  })

  test('an undefined import from another module is not the guard of three', () => {
    expect(
      judgeUndefinedImport({
        binding: 'missing',
        exporter: 'E:/repo/node_modules/zod/index.js',
        importer: 'E:/repo/src/lib/validation.ts',
      }),
    ).toBe('not-three')
  })

  test('every declared unreachable read states its reason', () => {
    for (const declared of UNREACHABLE_UNDEFINED_IMPORTS) {
      expect(declared.reason.length).toBeGreaterThan(0)
    }
  })
})
