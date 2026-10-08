// The three build guard: the app build resolves every 'three' import to one
// build, the webgpu build whose re-exports the whole app shares. Both three
// builds share their classes through three.core.js; what the classic entry
// adds is its renderer machinery, about 335 kB of code the app never
// instantiates. The alias keeps that code out of the bundle, and this guard
// keeps the alias honest in two ways:
//
// - a module graph that still holds the classic build means a 'three' import
//   escaped the alias and the classic renderer code ships again, so the
//   build fails naming the classic module;
// - a name only the classic entry exports, read through a 'three' namespace
//   import (THREE.WebGLRenderer), resolves to undefined against the webgpu
//   build; the bundler fails a named import of a missing name on its own,
//   but only warns on a namespace read and ships a silent undefined, so the
//   build fails naming the binding and its importer. The undefined reads a
//   package makes on a path the app provably never runs are declared below
//   with their reason.
import type { Plugin } from 'vite'

// The module file names the classic three build ships under. The shared
// core (three.core.js), the node system (three.tsl.js) and the webgpu build
// itself are the one build's own modules and never findings.
const CLASSIC_THREE_FILES = ['three/build/three.module.js', 'three/build/three.cjs'] as const

// The module the alias resolves every 'three' import to.
const WEBGPU_THREE_FILE = 'three/build/three.webgpu.js'

function normalized(path: string): string {
  return path.replaceAll('\\', '/')
}

// The module ids of the graph that resolve to the classic three build,
// normalized to forward slashes. Suffix matching: ids are absolute paths
// into the installed package, wherever the package manager laid it out.
export function classicThreeModuleIds(moduleIds: readonly string[]): string[] {
  return moduleIds
    .map(normalized)
    .filter((id) => CLASSIC_THREE_FILES.some((file) => id.endsWith(file)))
}

// One import the bundler resolved to undefined: the imported binding, the
// module that should export it and the module that imports it, both with
// forward slashes.
export interface UndefinedImport {
  readonly binding: string
  readonly exporter: string
  readonly importer: string
}

// The slice of a bundler log the guard reads.
export interface BundlerLog {
  readonly code?: string
  readonly message: string
  readonly id?: string
}

const UNDEFINED_IMPORT_CODE = 'IMPORT_IS_UNDEFINED'
// The bundler names the binding and the exporter only in its message, which
// may carry terminal colour codes.
const UNDEFINED_IMPORT_MESSAGE =
  /Import `([^`]+)` will always be undefined because there is no matching export in '([^']+)'/
const TERMINAL_CODES = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

// The undefined import a bundler log reports, or null for any other log.
// A log with the code but a message the pattern cannot read fails loudly:
// the guard must never pass an undefined import it could not identify.
export function readUndefinedImport(log: BundlerLog): UndefinedImport | null {
  if (log.code !== UNDEFINED_IMPORT_CODE) {
    return null
  }
  const match = UNDEFINED_IMPORT_MESSAGE.exec(log.message.replace(TERMINAL_CODES, ''))
  const binding = match?.[1]
  const exporter = match?.[2]
  if (binding === undefined || exporter === undefined || log.id === undefined) {
    throw new Error(`the three build guard cannot read this undefined import: ${log.message}`)
  }
  return { binding, exporter: normalized(exporter), importer: normalized(log.id) }
}

// An undefined import the app ships by design: a package's read of a name
// the webgpu build does not export, on a path the app never runs.
export interface UnreachableUndefinedImport {
  readonly importerPackage: string
  readonly binding: string
  readonly reason: string
}

export const UNREACHABLE_UNDEFINED_IMPORTS: readonly UnreachableUndefinedImport[] = [
  {
    importerPackage: '@react-three/fiber',
    binding: 'WebGLRenderer',
    reason:
      'R3F builds its default WebGLRenderer only for a Canvas given no gl factory, and the stage canvas always passes its renderer factory',
  },
]

function isDeclaredUnreachable(found: UndefinedImport): boolean {
  return UNREACHABLE_UNDEFINED_IMPORTS.some(
    (declared) =>
      declared.binding === found.binding &&
      found.importer.includes(`/node_modules/${declared.importerPackage}/`),
  )
}

// What the guard decides for one undefined import: a finding when the
// webgpu build lacks the name and no declared unreachable read covers it,
// declared when one does, and not ours when another module is the exporter.
export function judgeUndefinedImport(found: UndefinedImport): 'finding' | 'declared' | 'not-three' {
  if (!found.exporter.endsWith(WEBGPU_THREE_FILE)) {
    return 'not-three'
  }
  return isDeclaredUnreachable(found) ? 'declared' : 'finding'
}

export function threeBuildGuardPlugin(): Plugin {
  return {
    name: 'three-build-guard',
    apply: 'build',
    onLog(_level, log) {
      const found = readUndefinedImport(log)
      if (found === null) {
        return
      }
      const judged = judgeUndefinedImport(found)
      if (judged === 'finding') {
        throw new Error(
          `the webgpu three build does not export ${found.binding}, imported by ${found.importer}: it would ship as undefined`,
        )
      }
      // A declared unreachable read is settled by its stated reason, so its
      // warning is dropped instead of repeated on every build.
      return judged === 'declared' ? false : undefined
    },
    buildEnd(error) {
      if (error !== undefined) {
        return
      }
      const classic = classicThreeModuleIds([...this.getModuleIds()])
      if (classic.length > 0) {
        throw new Error(
          `the app build must hold one three build; these modules resolve to the classic three: ${classic.join(', ')}`,
        )
      }
    },
  }
}
