// Prepare asynchronous expansion before ESLint's synchronous rule visitors.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasExtension, scriptExtensions } from './extensions.ts'
import { globCalls } from './globCalls.ts'
import { createGlobFileTree } from './globFileTree.ts'
import { expandViteMode } from './globExpanders.ts'
import { expandGlobImports, globImportKey, readGlobImport } from './globImports.ts'
import type { GlobCall, GlobExpansion, GlobImportSource } from './globImports.ts'

export async function expandGatedGlob(
  root: string,
  call: GlobCall,
  importer: string,
  files: readonly string[],
): Promise<GlobExpansion> {
  const request = readGlobImport(call)
  if (request.kind !== 'request') return request
  const [javascript, native] = await Promise.all([
    expandViteMode(root, importer, request, false),
    expandViteMode(root, importer, request, true),
  ])
  return expandGlobImports(call, importer, files, { javascript, native })
}

export async function createGlobImportSource(
  root: string,
  files: readonly string[],
): Promise<GlobImportSource> {
  const calls = files
    .filter((file) => file.startsWith('src/') && hasExtension(file, scriptExtensions))
    .flatMap((importer) =>
      globCalls(readFileSync(join(root, importer), 'utf8'), importer).map((call) => ({
        call,
        importer,
      })),
    )
  const source = new Map<string, GlobExpansion>()
  if (calls.length === 0) return source
  const tree = createGlobFileTree(root, files)
  try {
    for (const { call, importer } of calls) {
      source.set(
        globImportKey(importer, call),
        await expandGatedGlob(tree.root, call, importer, files),
      )
    }
  } finally {
    tree.remove()
  }
  return source
}
