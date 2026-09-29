// The layers table of this repo, as data. The ESLint layer gate, the planted
// lint suite and the pinned table snapshot are all derived from this module,
// so the table, the gate and its proof cannot drift apart. Extend the data
// here when the architecture grows; never hand-write a second list anywhere
// else.

// Whether the layer's folder is one element, or a family of sibling elements,
// one per subfolder. Siblings see only each other's public entry, so their
// internals stay private even inside the layer.
export type ElementGranularity = 'one' | 'per-subfolder'

// Which external packages the layer may import. Every layer that may import
// some is still limited to the packages package.json declares; 'none' bans
// external and core imports outright.
export type ExternalPackages = 'declared' | 'none'

// A banned external package as a micromatch pattern, with one real specifier
// that matches it, so the gate's proof imports something that actually
// resolves.
export type PackageBan = {
  readonly pattern: string
  readonly sample: string
}

// What a layer's element is made of: importable modules, or a stylesheet,
// which hosts no import statements and is reached by a side-effect import.
// Every row declares one, so a new layer cannot be added without saying what
// it holds.
export type LayerArtifact = 'module' | 'stylesheet'

// The table itself, as const data. The row keys are the one place a layer
// name is written; the name union, the name list and every row's name are
// derived from them below. Keeping the rows as pure literals lets the
// assertion under the table check each edge against that same union.
const rawLayers = {
  app: {
    folder: 'app',
    elements: 'one',
    externals: 'declared',
    artifact: 'module',
    mayImport: ['features', 'viewer', 'ui', 'store', 'products', 'lib', 'styles'],
  },
  features: {
    folder: 'features',
    elements: 'per-subfolder',
    externals: 'declared',
    artifact: 'module',
    mayImport: ['features', 'viewer', 'ui', 'store', 'lib', 'styles'],
    publicEntry: 'index.ts',
  },
  viewer: {
    folder: 'viewer',
    elements: 'one',
    externals: 'declared',
    artifact: 'module',
    mayImport: ['store', 'lib', 'styles'],
  },
  ui: {
    folder: 'ui',
    elements: 'one',
    externals: 'declared',
    artifact: 'module',
    mayImport: ['lib', 'styles'],
    bannedPackages: [
      { pattern: 'three', sample: 'three' },
      { pattern: '@react-three/*', sample: '@react-three/fiber' },
    ],
  },
  store: {
    folder: 'store',
    elements: 'one',
    externals: 'declared',
    artifact: 'module',
    mayImport: ['lib'],
  },
  products: {
    folder: 'products',
    elements: 'one',
    externals: 'none',
    artifact: 'module',
    mayImport: ['lib'],
    typeOnlyImports: ['lib'],
  },
  lib: {
    folder: 'lib',
    elements: 'one',
    externals: 'declared',
    artifact: 'module',
    mayImport: [],
    bannedPackages: [
      { pattern: 'react', sample: 'react' },
      { pattern: 'react-dom', sample: 'react-dom' },
      { pattern: 'three', sample: 'three' },
      { pattern: '@react-three/*', sample: '@react-three/fiber' },
    ],
  },
  styles: {
    folder: 'styles',
    elements: 'one',
    externals: 'none',
    artifact: 'stylesheet',
    mayImport: [],
  },
} as const

export type LayerName = keyof typeof rawLayers

// A checked row of the table: an edge may name layers only, so a misspelled
// name in any row fails the declaration of `layers` below instead of building.
export type LayerRow = {
  // The folder under src/ holding this layer
  readonly folder: string
  readonly elements: ElementGranularity
  readonly externals: ExternalPackages
  readonly artifact: LayerArtifact
  // Layers this layer may import. Same-layer imports always stay allowed:
  // they never leave the layer's element, or stay between siblings through
  // their entries.
  readonly mayImport: readonly LayerName[]
  // Layers this layer reaches only through `import type`, without runtime
  // values
  readonly typeOnlyImports?: readonly LayerName[]
  // The only file through which other elements reach this layer
  readonly publicEntry?: string
  readonly bannedPackages?: readonly PackageBan[]
}

// A layer row with its name, carried from the key it sits under.
export type Layer = LayerRow & { readonly name: LayerName }

// The name list derives from the table keys, so a layer name is written once.
export const layerNames: readonly LayerName[] = Object.keys(rawLayers) as LayerName[]

// The table check itself: building this array upholds every row against
// LayerRow, so a misspelled edge, a wrong kind of field or a missing row
// fails right here.
export const layers: readonly Layer[] = layerNames.map((name) => ({ name, ...rawLayers[name] }))

function recordByName<Key extends string, Value>(
  entries: Iterable<readonly [Key, Value]>,
): Readonly<Record<Key, Value>> {
  return Object.fromEntries(entries) as Record<Key, Value>
}

// The same rows keyed by name, so callers reach one layer directly.
export const layerByName: Readonly<Record<LayerName, Layer>> = recordByName(
  layers.map((layer) => [layer.name, layer]),
)

// src/main.tsx is the composition root: it sits above every layer and imports
// the app shell only.
export const compositionRoot = {
  file: 'src/main.tsx',
  category: 'composition-root',
  mayImport: ['app'],
} as const

export type ImportAccess =
  // The import is unrestricted
  | 'runtime'
  // Only `import type` may cross this edge
  | 'type-only'
  // Only the target layer's publicEntry file may be imported
  | 'entry-only'
  // The edge is forbidden
  | 'none'

// The access a file in `from` has to a file of the `to` layer. Same-layer
// access depends on granularity: a one-element layer never leaves its element,
// while per-subfolder siblings are distinct elements, so the layer must grant
// itself the edge like any other, through the entry file where it has one.
export function importAccess(from: LayerName, to: LayerName): ImportAccess {
  const target = layerByName[to]
  if (from === to) {
    if (target.elements === 'one') {
      return 'runtime'
    }
    if (!target.mayImport.includes(to)) {
      return 'none'
    }
    return target.publicEntry === undefined ? 'runtime' : 'entry-only'
  }
  if (!layerByName[from].mayImport.includes(to)) {
    return 'none'
  }
  if (layerByName[from].typeOnlyImports?.includes(to)) {
    return 'type-only'
  }
  if (target.publicEntry !== undefined) {
    return 'entry-only'
  }
  return 'runtime'
}
