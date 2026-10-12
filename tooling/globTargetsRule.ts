// Glob targets are runtime imports: the layers table governs every expanded
// file, and fixture modules retain the same importer restriction as imports.
import { relative } from 'node:path'
import type { Rule } from 'eslint'
import { fixtureMarker, scriptExtensions, testFileMarkers } from './extensions.ts'
import { compositionRoot, importAccess, layers } from './layers.ts'
import type { Layer } from './layers.ts'
import { globImportKey, isGlobCall } from './globImports.ts'
import type { GlobImportSource } from './globImports.ts'

type Element = { readonly layer: Layer; readonly directory: string; readonly internalPath: string }

function elementOf(file: string): Element | undefined {
  for (const layer of layers) {
    const prefix = `src/${layer.folder}/`
    if (!file.startsWith(prefix)) continue
    const internal = file.slice(prefix.length)
    const slash = internal.indexOf('/')
    if (layer.elements === 'per-subfolder') {
      if (slash < 0) return undefined
      return {
        layer,
        directory: prefix + internal.slice(0, slash),
        internalPath: internal.slice(slash + 1),
      }
    }
    return { layer, directory: prefix.slice(0, -1), internalPath: internal }
  }
  return undefined
}

function hasMarker(file: string, markers: readonly string[]): boolean {
  return markers.some((marker) =>
    scriptExtensions.some((extension) => file.endsWith(`.${marker}.${extension}`)),
  )
}

function permittedTarget(importer: string, target: string): boolean {
  const fixture = hasMarker(target, [fixtureMarker])
  const supportImporter = hasMarker(importer, [...testFileMarkers, fixtureMarker])
  if (fixture && !supportImporter) return false
  if (!target.startsWith('src/')) return fixture && supportImporter
  const from = elementOf(importer)
  const to = elementOf(target)
  if (to === undefined) return false
  if (from?.directory === to.directory) return true
  if (importer === compositionRoot.file) {
    return compositionRoot.mayImport.some((name) => name === to.layer.name)
  }
  if (from === undefined) return false
  const access = importAccess(from.layer.name, to.layer.name)
  return (
    access === 'runtime' || (access === 'entry-only' && to.internalPath === to.layer.publicEntry)
  )
}

export function createGlobTargetsRule(root: string, source: GlobImportSource): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: { description: 'Expanded glob imports follow the layers and fixture policies' },
      schema: [],
      messages: {
        expansion: '{{message}}',
        empty: 'The glob matches no gated file.',
        target:
          'Glob target "{{target}}" is forbidden by the layers or fixture policy (tooling/layers.ts).',
      },
    },
    create(context) {
      const importer = relative(root, context.filename).replace(/\\/g, '/')
      return {
        CallExpression(node) {
          if (!isGlobCall(node)) return
          const expanded = source.get(globImportKey(importer, node)) ?? {
            kind: 'problem',
            message: 'The glob has no prepared gated-file expansion.',
          }
          if (expanded.kind === 'problem') {
            context.report({ node, messageId: 'expansion', data: { message: expanded.message } })
          } else if (expanded.files.length === 0) {
            context.report({ node, messageId: 'empty' })
          } else {
            for (const target of expanded.files) {
              if (!permittedTarget(importer, target)) {
                context.report({ node, messageId: 'target', data: { target } })
              }
            }
          }
        },
      }
    },
  }
}
