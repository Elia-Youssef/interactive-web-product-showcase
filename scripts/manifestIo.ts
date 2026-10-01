// How the pipeline reaches a product's manifest across the src boundary.
// Two loaders, each for one side of the convention:
//
// - readManifestFile loads the manifest .ts itself. The file is plain data
//   whose only import is a type, so Node 24 runs it directly and the type
//   import is erased.
// - loadParseProduct loads the product domain module (parseProduct). That
//   module resolves its own imports without extensions for the browser
//   bundle, which plain Node cannot execute, so it goes through jiti, the
//   TypeScript loader the tooling already carries.
//
// Both read their export through one boundary guard: the module's shape is
// never trusted, so a module of the wrong shape fails here, with the module
// and the export named, and not later at the value's point of use.
import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'
import type { parseProduct } from '../src/lib/product/index.ts'
import { isMissingFileError } from './fsErrors.ts'

export type ParseProduct = typeof parseProduct

export type ManifestLoad =
  | { kind: 'loaded'; manifest: unknown }
  | { kind: 'missing' }
  | { kind: 'noManifestExport' }
  | { kind: 'error'; reason: string }

// One named export of an imported module, read without a cast. The kind is
// whatever the caller's guard checks; a runtime check can only see that the
// export is there and of that kind, and the rest of the value's shape is
// the exporting module's own contract, pinned by its tests.
export type NamedExport<T> = { kind: 'present'; value: T } | { kind: 'absent' }

export function namedExport<T>(
  module: unknown,
  exportName: string,
  isKind: (value: unknown) => value is T,
): NamedExport<T> {
  if (typeof module !== 'object' || module === null || !Object.hasOwn(module, exportName)) {
    return { kind: 'absent' }
  }
  const value: unknown = Reflect.get(module, exportName)
  return isKind(value) ? { kind: 'present', value } : { kind: 'absent' }
}

// The manifest kind: the export is there. An export set to undefined is
// reported like a missing one, as before.
function isPresent(value: unknown): value is unknown {
  return value !== undefined
}

// The parseProduct kind: a function. The signature it is narrowed to is the
// domain module's own contract; manifestIo.test.ts runs the real module, so
// a signature drift fails there.
function isParseProduct(value: unknown): value is ParseProduct {
  return typeof value === 'function'
}

// True when the import itself failed because nothing exists at the path.
// A missing module is reported like a missing file (ERR_MODULE_NOT_FOUND
// where fs calls give ENOENT); every other import failure is the file's
// own problem and carries its message.
function isMissingModuleError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_MODULE_NOT_FOUND'
  )
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function readManifestFile(manifestFile: string): Promise<ManifestLoad> {
  let imported: unknown
  try {
    imported = await import(pathToFileURL(manifestFile).href)
  } catch (error) {
    if (isMissingFileError(error) || isMissingModuleError(error)) {
      return { kind: 'missing' }
    }
    return { kind: 'error', reason: reasonOf(error) }
  }
  const manifest = namedExport(imported, 'manifest', isPresent)
  if (manifest.kind === 'absent') {
    return { kind: 'noManifestExport' }
  }
  return { kind: 'loaded', manifest: manifest.value }
}

export async function loadParseProduct(): Promise<ParseProduct> {
  const domainFile = '../src/lib/product/index.ts'
  const jiti = createJiti(import.meta.url)
  const domain: unknown = await jiti.import(domainFile)
  const parse = namedExport(domain, 'parseProduct', isParseProduct)
  if (parse.kind === 'absent') {
    throw new Error(`expected a 'parseProduct' function export in ${domainFile}`)
  }
  return parse.value
}
