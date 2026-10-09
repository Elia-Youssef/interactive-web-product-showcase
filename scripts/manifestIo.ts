// How the pipeline reaches a product's manifest and the src modules across
// the src boundary. The loaders, each for one side of the convention:
//
// - readManifestFile loads the manifest .ts itself. The file is plain data
//   whose only import is a type, so Node 24 runs it directly and the type
//   import is erased.
// - loadParseProduct loads the product domain module (parseProduct). That
//   module resolves its own imports without extensions for the browser
//   bundle, which plain Node cannot execute, so it goes through jiti, the
//   TypeScript loader the tooling already carries.
// - loadCopyMeta loads the link-preview copy builder (src/lib/copy/meta.ts)
//   the same way; its import tree reaches the product domain through the
//   '@lib' alias, so the domain loader carries that alias.
// - loadCameraContract loads the camera contract's rule assembly and its
//   pivot rule the same way: they are the camera modules whose import trees
//   carry extensionless imports. The camera modules with no such import
//   (the authored data, the frame function, the view geometry) the scripts
//   import natively, so no module loads two ways in one run.
//
// The jiti loaders read their export through one boundary guard: the
// module's shape is never trusted, so a module of the wrong shape fails
// here, with the module and the export named, and not later at the value's
// point of use.
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import type { parseProduct } from '../src/lib/product/index.ts'
import type { cameraContractProblems } from '../src/lib/camera/contract.ts'
import type { viewPivotOf } from '../src/lib/camera/pivot.ts'
import type { MetaHeadSet, ProductMetaSet } from '../src/lib/copy/meta.ts'
import type { Product } from '../src/lib/product/index.ts'
import type { crawlFiles } from '../src/lib/copy/crawl.ts'
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

// The domain loader: jiti with the '@lib' alias the src tree resolves
// through, so the loaded modules may import each other the way the browser
// bundle resolves them.
function createDomainJiti(
  options: { readonly moduleCache?: boolean } = {},
): ReturnType<typeof createJiti> {
  return createJiti(import.meta.url, {
    alias: { '@lib': fileURLToPath(new URL('../src/lib', import.meta.url)) },
    ...options,
  })
}

export async function loadParseProduct(): Promise<ParseProduct> {
  const domainFile = '../src/lib/product/index.ts'
  const jiti = createDomainJiti()
  const domain: unknown = await jiti.import(domainFile)
  const parse = namedExport(domain, 'parseProduct', isParseProduct)
  if (parse.kind === 'absent') {
    throw new Error(`expected a 'parseProduct' function export in ${domainFile}`)
  }
  return parse.value
}

// The copy meta builder's kind: the three functions the build steps call.
// The narrowed signatures are the copy module's own contract, pinned by its
// unit tests; a runtime check can only see that the export is a function.
export type CopyMeta = {
  readonly siteMetaSet: () => MetaHeadSet
  readonly productMetaSet: (product: Product) => ProductMetaSet | null
  readonly socialImagePath: (slug: string) => string
}

function isSiteMetaSet(value: unknown): value is CopyMeta['siteMetaSet'] {
  return typeof value === 'function'
}

function isProductMetaSet(value: unknown): value is CopyMeta['productMetaSet'] {
  return typeof value === 'function'
}

function isSocialImagePath(value: unknown): value is CopyMeta['socialImagePath'] {
  return typeof value === 'function'
}

function copyExport<T>(
  module: unknown,
  exportName: string,
  isKind: (value: unknown) => value is T,
): T {
  const value = namedExport(module, exportName, isKind)
  if (value.kind === 'absent') {
    throw new Error(`expected a '${exportName}' export in the copy meta module`)
  }
  return value.value
}

// Reads current copy on each call, so a development HTML transform sees
// edits without restarting. The transpiled source cache remains reusable.
export async function loadCopyMeta(): Promise<CopyMeta> {
  const copyFile = '../src/lib/copy/meta.ts'
  const jiti = createDomainJiti({ moduleCache: false })
  const copyModule: unknown = await jiti.import(copyFile)
  return {
    siteMetaSet: copyExport(copyModule, 'siteMetaSet', isSiteMetaSet),
    productMetaSet: copyExport(copyModule, 'productMetaSet', isProductMetaSet),
    socialImagePath: copyExport(copyModule, 'socialImagePath', isSocialImagePath),
  }
}

function isCrawlFiles(value: unknown): value is typeof crawlFiles {
  return typeof value === 'function'
}

export async function loadCrawlFiles(): Promise<typeof crawlFiles> {
  const jiti = createDomainJiti({ moduleCache: false })
  const module: unknown = await jiti.import('../src/lib/copy/crawl.ts')
  return copyExport(module, 'crawlFiles', isCrawlFiles)
}

// The camera contract's rule assembly, as the type of the module it
// loads. The module tree carries extensionless imports (the src convention
// for the browser bundle), so it crosses the src boundary through this
// jiti bridge, the way the product domain does. The camera modules that
// import nothing at runtime (the authored data, the frame function) the
// scripts import natively instead.
export type CameraContract = {
  readonly cameraContractProblems: typeof cameraContractProblems
  readonly viewPivotOf: typeof viewPivotOf
}

// The boundary guard kinds: a function. The narrowed signatures are the
// camera domain modules' own contracts, pinned by their unit tests.
function isContractProblemsFunction(
  value: unknown,
): value is CameraContract['cameraContractProblems'] {
  return typeof value === 'function'
}

function isViewPivotFunction(value: unknown): value is CameraContract['viewPivotOf'] {
  return typeof value === 'function'
}

function contractExport<T>(
  module: unknown,
  exportName: string,
  isKind: (value: unknown) => value is T,
): T {
  const value = namedExport(module, exportName, isKind)
  if (value.kind === 'absent') {
    throw new Error(`expected a '${exportName}' export in the camera contract module`)
  }
  return value.value
}

// Loads the camera contract's rule assembly and its pivot rule, each from
// its own module.
export async function loadCameraContract(): Promise<CameraContract> {
  const jiti = createJiti(import.meta.url)
  const contractModule: unknown = await jiti.import('../src/lib/camera/contract.ts')
  const pivotModule: unknown = await jiti.import('../src/lib/camera/pivot.ts')
  return {
    cameraContractProblems: contractExport(
      contractModule,
      'cameraContractProblems',
      isContractProblemsFunction,
    ),
    viewPivotOf: contractExport(pivotModule, 'viewPivotOf', isViewPivotFunction),
  }
}
