// The layer matrix cases: for every ordered pair of layers, an import is
// allowed exactly when the layers table allows it, with the table's narrowing
// by entry file and import kind. Plus the composition root and the stray file
// that belongs to no layer.
import { importAccess, layers } from './layers.ts'
import type { Layer } from './layers.ts'
import {
  LAYERS_RULE,
  caseDirectory,
  internalSpecifier,
  pairPath,
  publicSpecifier,
  sampleElements,
  sideEffectImport,
  typeImport,
  valueImport,
} from './plantedShapes.ts'
import type { PlantedCase } from './plantedShapes.ts'
import { aliasFor } from './lintTree.ts'

function importStatement(to: Layer, kind: 'value' | 'type'): string {
  const specifier = publicSpecifier(to)
  if (to.artifact === 'stylesheet') {
    return sideEffectImport(specifier)
  }
  return kind === 'type' ? typeImport(specifier) : valueImport(specifier)
}

function sameElementCase(from: Layer): PlantedCase {
  return {
    title: `${from.name} reaches its own element internals`,
    tree: 'clean',
    file: `${caseDirectory(from)}/same-element.ts`,
    code: valueImport('./internals'),
    expectedRuleIds: [],
  }
}

// Siblings live in the second element: reaching one is a cross-element import
// the table governs like any other edge.
function siblingCases(from: Layer): PlantedCase[] {
  const alias = aliasFor(from.folder)
  const siblingEntry = `${alias}/${sampleElements[1]}`
  const siblingInternals = `${alias}/${sampleElements[1]}/internals`
  const access = importAccess(from.name, from.name)
  if (access === 'none') {
    return [
      {
        title: `${from.name} reaching a sibling element it does not grant itself`,
        tree: 'violations',
        file: pairPath(from, from),
        code: valueImport(siblingInternals),
        expectedRuleIds: [LAYERS_RULE],
      },
    ]
  }
  if (access === 'entry-only') {
    return [
      {
        title: `${from.name} reaches a sibling element through its entry`,
        tree: 'clean',
        file: pairPath(from, from, '-entry'),
        code: valueImport(siblingEntry),
        expectedRuleIds: [],
      },
      {
        title: `${from.name} reaching sibling internals is private`,
        tree: 'violations',
        file: pairPath(from, from, '-internal'),
        code: valueImport(siblingInternals),
        expectedRuleIds: [LAYERS_RULE],
      },
    ]
  }
  return [
    {
      title: `${from.name} imports a sibling element file`,
      tree: 'clean',
      file: pairPath(from, from, '-sibling'),
      code: valueImport(siblingInternals),
      expectedRuleIds: [],
    },
  ]
}

function sameLayerCases(from: Layer): PlantedCase[] {
  if (from.elements !== 'per-subfolder') {
    return [
      {
        title: `${from.name} imports inside its own element`,
        tree: 'clean',
        file: `${caseDirectory(from)}/same-layer.ts`,
        code: valueImport('./target'),
        expectedRuleIds: [],
      },
    ]
  }
  return [sameElementCase(from), ...siblingCases(from)]
}

function typeOnlyCases(from: Layer, to: Layer): PlantedCase[] {
  return [
    {
      title: `${from.name} importing a runtime value from ${to.name}`,
      tree: 'violations',
      file: pairPath(from, to),
      code: importStatement(to, 'value'),
      expectedRuleIds: [LAYERS_RULE],
    },
    {
      title: `${from.name} importing only types from ${to.name}`,
      tree: 'clean',
      file: pairPath(from, to, '-type'),
      code: importStatement(to, 'type'),
      expectedRuleIds: [],
    },
  ]
}

function entryOnlyCases(from: Layer, to: Layer): PlantedCase[] {
  return [
    {
      title: `${from.name} reaches ${to.name} through its entry`,
      tree: 'clean',
      file: pairPath(from, to),
      code: importStatement(to, 'value'),
      expectedRuleIds: [],
    },
    {
      title: `${from.name} reaching ${to.name} internals`,
      tree: 'violations',
      file: pairPath(from, to, '-internal'),
      code: valueImport(internalSpecifier(to)),
      expectedRuleIds: [LAYERS_RULE],
    },
  ]
}

function crossLayerCases(from: Layer, to: Layer): PlantedCase[] {
  const access = importAccess(from.name, to.name)
  if (access === 'runtime') {
    return [
      {
        title: `${from.name} imports ${to.name}: runtime`,
        tree: 'clean',
        file: pairPath(from, to),
        code: importStatement(to, 'value'),
        expectedRuleIds: [],
      },
    ]
  }
  if (access === 'none') {
    return [
      {
        title: `${from.name} importing ${to.name} breaks the table`,
        tree: 'violations',
        file: pairPath(from, to),
        code: importStatement(to, 'value'),
        expectedRuleIds: [LAYERS_RULE],
      },
    ]
  }
  if (access === 'type-only') {
    return typeOnlyCases(from, to)
  }
  return entryOnlyCases(from, to)
}

export function matrixCases(): PlantedCase[] {
  const cases: PlantedCase[] = []
  for (const from of layers) {
    // A stylesheet hosts no import statement, so it originates no case; the
    // table already grants it access to nothing.
    if (from.artifact === 'stylesheet') {
      continue
    }
    for (const to of layers) {
      cases.push(...(from.name === to.name ? sameLayerCases(from) : crossLayerCases(from, to)))
    }
  }
  return cases
}

export function compositionRootCases(): PlantedCase[] {
  return [
    {
      title: 'the composition root importing below the app layer',
      tree: 'violations',
      file: 'src/main.tsx',
      code: valueImport('@viewer/target'),
      expectedRuleIds: [LAYERS_RULE],
    },
    {
      title: 'the gate anchors at the config root when eslint runs from a subdirectory',
      tree: 'violations',
      lintFrom: 'subdirectory',
      file: 'src/main.tsx',
      code: valueImport('@viewer/target'),
      expectedRuleIds: [LAYERS_RULE],
    },
    {
      title: 'the composition root imports declared packages and the app layer',
      tree: 'clean',
      file: 'src/main.tsx',
      code: [
        "import { StrictMode } from 'react'",
        "import { createRoot } from 'react-dom/client'",
        "import { App } from '@app/target'",
        'export const planted = { StrictMode, createRoot, App }',
        '',
      ].join('\n'),
      expectedRuleIds: [],
    },
    {
      title: 'files that belong to no layer are reported',
      tree: 'violations',
      file: 'src/stray.ts',
      code: 'export const planted = 1\n',
      expectedRuleIds: ['boundaries/no-unknown-files'],
    },
  ]
}
