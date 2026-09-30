// The shared vocabulary of the planted lint suite: the case shape, the
// statement and specifier builders every case group uses, and the fixture
// generators for size probes. The case groups live in their own modules; this
// one owns nothing but the shapes.
import { aliasFor } from './lintTree.ts'
import { layers } from './layers.ts'
import type { Layer, LayerName } from './layers.ts'

export const LAYERS_RULE = 'boundaries/dependencies'

export type PlantedCase = {
  readonly title: string
  readonly tree: 'violations' | 'clean'
  readonly file: string
  readonly code: string
  // Empty means the file must lint clean
  readonly expectedRuleIds: readonly string[]
  // The working directory the lint runs from for this case: the tree root by
  // default, or one of its subdirectories, which proves the config anchors
  // its own root instead of the invocation directory. Only violations-tree
  // cases need the subdirectory run.
  readonly lintFrom?: 'root' | 'subdirectory'
}

// Per-subfolder layers get these sibling elements planted. The names carry no
// meaning beyond being two distinct elements.
export const sampleElements = ['element-a', 'element-b'] as const

// The layers someone reaches through import type only: their planted targets
// export a type as well as a value.
export const typeTargetLayers: readonly LayerName[] = layers
  .flatMap((layer) => layer.typeOnlyImports ?? [])
  .filter((name, index, all) => all.indexOf(name) === index)

export function valueImportOf(name: string, specifier: string): string {
  return `import { ${name} } from '${specifier}'\nexport const planted = ${name}\n`
}

export function valueImport(specifier: string): string {
  return valueImportOf('layerTarget', specifier)
}

export function typeImport(specifier: string): string {
  return `import type { LayerTarget } from '${specifier}'\nexport const planted: LayerTarget = 'planted'\n`
}

export function sideEffectImport(specifier: string): string {
  return `import '${specifier}'\nexport const planted = 1\n`
}

// The stylesheet every stylesheet layer is planted with, and the module name
// importers reach it by.
export const stylesheetName = 'global.css'

export function publicSpecifier(layer: Layer): string {
  const alias = aliasFor(layer.folder)
  if (layer.artifact === 'stylesheet') {
    return `${alias}/${stylesheetName}`
  }
  return layer.elements === 'per-subfolder' ? `${alias}/${sampleElements[0]}` : `${alias}/target`
}

export function internalSpecifier(layer: Layer): string {
  return `${aliasFor(layer.folder)}/${sampleElements[0]}/internals`
}

// Files of the importing layer live in its first sample element when the
// layer is a family, and directly in its folder otherwise.
export function caseDirectory(layer: Layer): string {
  return layer.elements === 'per-subfolder'
    ? `src/${layer.folder}/${sampleElements[0]}`
    : `src/${layer.folder}`
}

export function pairPath(from: Layer, to: Layer, suffix = ''): string {
  return `${caseDirectory(from)}/pair-${from.name}-${to.name}${suffix}.ts`
}

export function targetModuleCode(layer: Layer): string {
  const lines = [`export const layerTarget = '${layer.name}'`]
  if (typeTargetLayers.includes(layer.name)) {
    lines.push('export type LayerTarget = string')
  }
  return `${lines.join('\n')}\n`
}

export function exportLines(count: number): string {
  const lines = Array.from(
    { length: count },
    (_, index) => `export const planted${index} = ${index}`,
  )
  return `${lines.join('\n')}\n`
}

// The planted function spans additions + 4 code lines, every line used.
export function longFunction(additions: number): string {
  const body = Array.from({ length: additions }, (_, index) => `  value += ${index + 1}`)
  return [
    'export function plantedFunction(): number {',
    '  let value = 0',
    ...body,
    '  return value',
    '}',
    '',
  ].join('\n')
}

export function slug(specifier: string): string {
  return specifier.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')
}
