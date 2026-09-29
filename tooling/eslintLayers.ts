// Derives the ESLint layer gate from the layers table in layers.ts. Every
// element definition and every policy below is generated from that data, so
// the config holds no second hand-written list. The gate is fail-closed: any
// import the table does not allow, from any origin, falls through to the rule
// default and is reported.
import boundaries from 'eslint-plugin-boundaries'
import type { DependenciesPolicy } from 'eslint-plugin-boundaries'
import type { Linter } from 'eslint'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extensionGlob,
  scriptExtensions,
  sourceExtensions,
  testFileGlob,
  testFileMarkers,
} from './extensions.ts'
import { compositionRoot, layerByName, layerNames, layers } from './layers.ts'
import type { Layer, LayerName } from './layers.ts'

const SOURCE_FILES = `src/**/*.${extensionGlob(scriptExtensions)}`

// The test files form a file category of their own: the layer policies keep
// applying to them, and they alone may import the dev tools.
const TEST_FILES = testFileGlob(testFileMarkers, sourceExtensions)
const TEST_CATEGORY = 'test'

// The packages package.json declares, split by manifest section, as
// micromatch patterns over the module names importers may use, subpaths
// included. Production code under src/ may import the runtime half only;
// test files may also import the dev half, their own tools. An alias-shaped
// or misspelled specifier that resolves to nothing matches none of them, so
// the fail-closed default catches it instead of waving it through as an
// external. The arrays are freshly built per call; the boundaries selector
// type takes them mutable.
export type DeclaredPackagePatterns = {
  readonly runtime: string[]
  readonly dev: string[]
}

function packagePatterns(section: Record<string, string> | undefined): string[] {
  return Object.keys(section ?? {}).flatMap((name) => [name, `${name}/*`])
}

export function declaredPackagePatterns(root: string): DeclaredPackagePatterns {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  return {
    runtime: packagePatterns(manifest.dependencies),
    dev: packagePatterns(manifest.devDependencies),
  }
}

function elementPattern(layer: Layer): string {
  // A per-subfolder layer is a family of elements, one per subfolder; every
  // other layer is a single element.
  return layer.elements === 'per-subfolder' ? `src/${layer.folder}/*` : `src/${layer.folder}`
}

function forbiddenTargets(mayImport: readonly LayerName[]): LayerName[] {
  return layerNames.filter((name) => !mayImport.includes(name))
}

function allowedTargets(mayImport: readonly LayerName[]): string {
  return mayImport.length === 0
    ? 'imports no other layer'
    : `may import only ${mayImport.join(', ')}`
}

// The edges this layer may cross, narrowed by the target's entry file and
// import kind where the table asks for it.
function allowedEdges(layer: Layer): DependenciesPolicy['allow'] {
  return layer.mayImport.map((to) => {
    const target = layerByName[to]
    const selector = {
      to: {
        element: {
          type: to,
          ...(target.publicEntry !== undefined ? { fileInternalPath: target.publicEntry } : {}),
        },
      },
    }
    return layer.typeOnlyImports?.includes(to)
      ? { ...selector, dependency: [{ kind: 'type' as const }] }
      : selector
  })
}

function layerPolicies(layer: Layer): DependenciesPolicy[] {
  const policies: DependenciesPolicy[] = [
    { from: { element: { type: layer.name } }, allow: allowedEdges(layer) },
  ]

  const forbidden = forbiddenTargets(layer.mayImport).filter((name) => name !== layer.name)
  if (forbidden.length > 0) {
    policies.push({
      from: { element: { type: layer.name } },
      disallow: { to: { element: { types: forbidden } } },
      message: `The ${layer.name} layer ${allowedTargets(layer.mayImport)} (tooling/layers.ts).`,
    })
  }

  for (const to of layer.typeOnlyImports ?? []) {
    policies.push({
      from: { element: { type: layer.name } },
      disallow: { to: { element: { type: to } }, dependency: [{ kind: 'value' as const }] },
      message: `The ${layer.name} layer reaches ${to} through types only: use import type.`,
    })
  }

  if (layer.externals === 'none') {
    policies.push({
      from: { element: { type: layer.name } },
      disallow: { to: { module: { origin: ['external', 'core'] } } },
      message: `The ${layer.name} layer imports no external package (tooling/layers.ts).`,
    })
  } else if (layer.bannedPackages !== undefined) {
    const patterns = layer.bannedPackages.map((ban) => ban.pattern)
    policies.push({
      from: { element: { type: layer.name } },
      disallow: { to: { module: { origin: ['external', 'core'], source: patterns } } },
      message: `The ${layer.name} layer never imports ${patterns.join(', ')}.`,
    })
  }

  if (layer.publicEntry !== undefined) {
    policies.push({
      disallow: {
        to: { element: { type: layer.name, fileInternalPath: `!${layer.publicEntry}` } },
      },
      message: `The ${layer.name} layer is reached only through its ${layer.publicEntry}: internals are private.`,
    })
  }

  return policies
}

function compositionRootPolicies(): DependenciesPolicy[] {
  const from = { file: { categories: [compositionRoot.category] } }
  return [
    { from, allow: { to: { element: { type: 'app' } } } },
    {
      from,
      disallow: { to: { element: { types: forbiddenTargets(compositionRoot.mayImport) } } },
      message: `${compositionRoot.file} is the composition root: it imports the app layer only.`,
    },
  ]
}

export function layerPoliciesAll(root: string): DependenciesPolicy[] {
  const { runtime, dev } = declaredPackagePatterns(root)
  return [
    // Runtime packages are free for every layer; later policies still win,
    // so a layer ban or the data-only products layer overrides this entry.
    { allow: { to: { module: { origin: 'external', source: runtime } } } },
    // Dev tools do not ship: production code imports runtime packages only.
    // The test-file allowance below is the one exception, and layer
    // policies after it still override both.
    {
      disallow: { to: { module: { origin: 'external', source: dev } } },
      message:
        'Dev dependencies are the tools of test files: production code imports runtime packages only (tooling/eslintLayers.ts).',
    },
    {
      from: { file: { categories: [TEST_CATEGORY] } },
      allow: { to: { module: { origin: 'external', source: dev } } },
    },
    ...layers.flatMap(layerPolicies),
    ...compositionRootPolicies(),
  ]
}

export function layerConfigs(root: string): Linter.Config[] {
  return [
    {
      files: [SOURCE_FILES],
      plugins: { boundaries },
      settings: {
        // Element matching anchors at the factory root, not at the working
        // directory the lint happens to run from: patterns like src/app
        // resolve against this path wherever eslint was invoked.
        'boundaries/root-path': root,
        // No include list: every local file is in scope, so an import that
        // escapes src/ into the rest of the repo reaches an unknown local
        // element and fails, instead of being waved through as ignored.
        // Packages under node_modules stay external by resolution, not by
        // inclusion.
        'boundaries/elements': layers.map((layer) => ({
          type: layer.name,
          pattern: elementPattern(layer),
          partialMatch: false,
        })),
        'boundaries/files': [
          { category: compositionRoot.category, pattern: compositionRoot.file },
          { category: TEST_CATEGORY, pattern: TEST_FILES },
        ],
      },
      rules: {
        // Unknown locals are errors, not noise to skip: a local import the
        // elements matcher cannot classify falls through to the disallow
        // default, and so does an alias-shaped specifier that resolves to
        // nothing, because it matches no declared package pattern.
        'boundaries/dependencies': [
          'error',
          {
            default: 'disallow',
            checkAllOrigins: true,
            checkUnknownLocals: true,
            message:
              'Imports must follow the layers table. The allowed graph lives in tooling/layers.ts.',
            policies: layerPoliciesAll(root),
          },
        ],
        'boundaries/no-unknown-files': 'error',
      },
    },
  ]
}
