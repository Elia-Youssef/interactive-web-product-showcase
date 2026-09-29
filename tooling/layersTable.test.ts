// Pins the layers table itself, not only the gate that reads it. The suite in
// lintRules.test.ts proves the ESLint rules match tooling/layers.ts; the
// rendered snapshot here proves the table matches the reviewed architecture.
// Any edit to the table, from an access edge to a banned package, changes
// this snapshot and has to be reviewed.
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declaredPackagePatterns } from './eslintLayers.ts'
import { compositionRoot, importAccess, layerNames, layers } from './layers.ts'
import type { LayerName } from './layers.ts'

function renderTable(): string {
  const lines: string[] = []
  for (const layer of layers) {
    const shape = layer.elements === 'per-subfolder' ? 'one element per subfolder' : 'one element'
    lines.push(
      `${layer.name} (src/${layer.folder}, ${shape}, artifact: ${layer.artifact}, externals: ${layer.externals})`,
    )
    for (const to of layerNames) {
      lines.push(`  imports ${to}: ${importAccess(layer.name, to)}`)
    }
    for (const ban of layer.bannedPackages ?? []) {
      lines.push(`  bans ${ban.pattern} (sample ${ban.sample})`)
    }
    if (layer.typeOnlyImports !== undefined && layer.typeOnlyImports.length > 0) {
      lines.push(`  type-only: ${layer.typeOnlyImports.join(', ')}`)
    }
    lines.push(`  entry: ${layer.publicEntry ?? 'none'}`)
  }
  lines.push(
    `composition root ${compositionRoot.file} may import ${compositionRoot.mayImport.join(', ')}`,
  )
  return lines.join('\n')
}

// Every name also carries its name/* subpath pattern; the split of the base
// names across the manifest sections is the pinned part.
function renderDeclaredPackages(): string {
  const { runtime, dev } = declaredPackagePatterns(resolve(import.meta.dirname, '..'))
  const baseNames = (patterns: readonly string[]) =>
    patterns.filter((pattern) => !pattern.endsWith('/*')).join(', ')
  return [`runtime packages: ${baseNames(runtime)}`, `dev packages: ${baseNames(dev)}`].join('\n')
}

describe('the layers table', () => {
  it('matches the reviewed snapshot', () => {
    expect([renderTable(), renderDeclaredPackages()].join('\n')).toMatchInlineSnapshot(`
      "app (src/app, one element, artifact: module, externals: declared)
        imports app: runtime
        imports features: entry-only
        imports viewer: runtime
        imports ui: runtime
        imports store: runtime
        imports products: runtime
        imports lib: runtime
        imports styles: runtime
        entry: none
      features (src/features, one element per subfolder, artifact: module, externals: declared)
        imports app: none
        imports features: entry-only
        imports viewer: runtime
        imports ui: runtime
        imports store: runtime
        imports products: none
        imports lib: runtime
        imports styles: runtime
        entry: index.ts
      viewer (src/viewer, one element, artifact: module, externals: declared)
        imports app: none
        imports features: none
        imports viewer: runtime
        imports ui: none
        imports store: runtime
        imports products: none
        imports lib: runtime
        imports styles: runtime
        entry: none
      ui (src/ui, one element, artifact: module, externals: declared)
        imports app: none
        imports features: none
        imports viewer: none
        imports ui: runtime
        imports store: none
        imports products: none
        imports lib: runtime
        imports styles: runtime
        bans three (sample three)
        bans @react-three/* (sample @react-three/fiber)
        entry: none
      store (src/store, one element, artifact: module, externals: declared)
        imports app: none
        imports features: none
        imports viewer: none
        imports ui: none
        imports store: runtime
        imports products: none
        imports lib: runtime
        imports styles: none
        entry: none
      products (src/products, one element, artifact: module, externals: none)
        imports app: none
        imports features: none
        imports viewer: none
        imports ui: none
        imports store: none
        imports products: runtime
        imports lib: type-only
        imports styles: none
        type-only: lib
        entry: none
      lib (src/lib, one element, artifact: module, externals: declared)
        imports app: none
        imports features: none
        imports viewer: none
        imports ui: none
        imports store: none
        imports products: none
        imports lib: runtime
        imports styles: none
        bans react (sample react)
        bans react-dom (sample react-dom)
        bans three (sample three)
        bans @react-three/* (sample @react-three/fiber)
        entry: none
      styles (src/styles, one element, artifact: stylesheet, externals: none)
        imports app: none
        imports features: none
        imports viewer: none
        imports ui: none
        imports store: none
        imports products: none
        imports lib: none
        imports styles: runtime
        entry: none
      composition root src/main.tsx may import app
      runtime packages: @react-three/drei, @react-three/fiber, react, react-dom, three, zod, zustand
      dev packages: @csstools/css-parser-algorithms, @csstools/css-tokenizer, @eslint/js, @playwright/test, @types/node, @types/react, @types/react-dom, @types/three, @vitejs/plugin-react, eslint, eslint-config-prettier, eslint-import-resolver-typescript, eslint-plugin-boundaries, eslint-plugin-import-x, eslint-plugin-react-hooks, globals, jiti, postcss, prettier, typescript, typescript-eslint, vite, vitest"
    `)
  })

  // The matrix only means anything over a sound table. Imports flow downward,
  // so a loosened edge that closes a layer cycle must fail here. A
  // per-subfolder layer importing its own layer is the one allowed loop:
  // siblings reach each other through their index.
  it('keeps the layer graph acyclic', () => {
    const state = new Map<LayerName, 'visiting' | 'done'>()
    const walk = (layer: LayerName, path: LayerName[]): LayerName[] | undefined => {
      const status = state.get(layer)
      if (status === 'done') {
        return undefined
      }
      if (status === 'visiting') {
        return [...path, layer]
      }
      state.set(layer, 'visiting')
      for (const next of layers.find((candidate) => candidate.name === layer)?.mayImport ?? []) {
        if (next !== layer) {
          const cycle = walk(next, [...path, layer])
          if (cycle !== undefined) {
            return cycle
          }
        }
      }
      state.set(layer, 'done')
      return undefined
    }
    for (const layer of layerNames) {
      expect(walk(layer, []), `layer cycle found starting at ${layer}`).toBeUndefined()
    }
  })
})
