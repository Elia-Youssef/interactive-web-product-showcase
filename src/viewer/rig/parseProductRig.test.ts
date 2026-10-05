import { expect, test } from 'vitest'
import { AnimationClip, Object3D } from 'three'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import {
  attach,
  cameraNode,
  explodeClip,
  named,
  sourceOf,
  validTree,
  variantsJson,
} from './fixtures'
import { readVariantNames } from '@lib/product'
import { parseProductRig, type ProductSource } from './parseProductRig'
import type { ProductRig } from './productRig'
import { summarizeProductRig } from './summary'

// The parsed manifest every tree is parsed against, so the rig tests run
// over the real schema output, explode block normalized included.
const manifest = parseProduct(sampleOneManifest, 'sample-one.test')

// The rig of a tree the test expects to parse; a broken parse fails the
// test with the problems it listed.
function parsedRig(source: ProductSource): ProductRig {
  const parse = parseProductRig(source, manifest)
  if (parse.kind === 'broken') {
    throw new Error(`the tree must parse, it broke with: ${JSON.stringify(parse.problems)}`)
  }
  return parse.rig
}

type ParseCase = {
  readonly name: string
  readonly source: ProductSource
  // The problems a broken tree must list, by the node they name (null for
  // problems about animations). Empty means the parse must succeed.
  readonly expectedProblems: readonly { readonly node: string | null }[]
}

const cases: ParseCase[] = [
  {
    name: 'a valid tree parses without problems',
    source: sourceOf(validTree()),
    expectedProblems: [],
  },
  {
    name: 'a hotspot under an unnamed wrapper under its part parses',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_home'),
        attach(named('PART_body'), new Object3D().add(named('HS_shell'))),
        attach(named('PART_grille'), named('HS_driver')),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [],
  },
  {
    name: 'a hotspot parented to the scene root is a problem',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_home'),
        named('HS_shell'),
        attach(named('PART_body')),
        attach(named('PART_grille'), named('HS_driver')),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [{ node: 'HS_shell' }],
  },
  {
    name: 'a hotspot under a named non-PART node is a problem',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_home'),
        attach(named('TRIM_STATIC'), named('HS_shell')),
        attach(named('PART_grille'), named('HS_driver')),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [{ node: 'HS_shell' }],
  },
  {
    name: 'a manifest hotspot without its HS_ node is a problem',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_home'),
        attach(named('PART_body')),
        attach(named('PART_grille'), named('HS_driver')),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [{ node: 'HS_shell' }],
  },
  {
    name: 'a missing CAM_home is a problem',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_driver'),
        attach(named('PART_body'), named('HS_shell')),
        attach(named('PART_grille'), named('HS_driver')),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [{ node: 'CAM_home' }],
  },
  {
    name: 'a CAM_home node without a camera object is a problem',
    source: sourceOf(
      new Object3D().add(
        named('CAM_home'),
        attach(named('PART_body'), named('HS_shell')),
        attach(named('PART_grille'), named('HS_driver')),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [{ node: 'CAM_home' }],
  },
  {
    name: 'a missing SHADOW node is a problem',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_home'),
        attach(named('PART_body'), named('HS_shell')),
        attach(named('PART_grille'), named('HS_driver')),
      ),
    ),
    expectedProblems: [{ node: 'SHADOW' }],
  },
  {
    name: 'a duplicated SHADOW node is a problem',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_home'),
        attach(named('PART_body'), named('HS_shell')),
        attach(named('PART_grille'), named('HS_driver')),
        named('SHADOW'),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [{ node: 'SHADOW' }],
  },
  {
    name: 'a missing explode clip is a problem',
    source: sourceOf(validTree(), []),
    expectedProblems: [{ node: null }],
  },
  {
    name: 'a duplicated explode clip is a problem',
    source: sourceOf(validTree(), [explodeClip(0.5), explodeClip(1.5)]),
    expectedProblems: [{ node: null }],
  },
  {
    name: 'an animation besides the explode clip is a problem',
    source: sourceOf(validTree(), [explodeClip(0.5), new AnimationClip('Idle', 2, [])]),
    expectedProblems: [{ node: null }],
  },
  {
    name: 'a duplicated PART_ name is a problem',
    source: sourceOf(
      new Object3D().add(
        cameraNode('CAM_home'),
        attach(named('PART_body'), named('HS_shell')),
        attach(named('PART_grille'), named('HS_driver')),
        named('PART_body'),
        named('SHADOW'),
      ),
    ),
    expectedProblems: [{ node: 'PART_body' }],
  },
  {
    name: 'several problems at once are all reported in one error',
    // No CAM_home, HS_shell gone, SHADOW gone, and an extra animation.
    source: sourceOf(
      new Object3D().add(
        attach(named('PART_body')),
        attach(named('PART_grille'), named('HS_driver')),
      ),
      [explodeClip(0.5), new AnimationClip('Idle', 2, [])],
    ),
    expectedProblems: [
      { node: 'HS_shell' },
      { node: 'CAM_home' },
      { node: 'SHADOW' },
      { node: null },
    ],
  },
]

test.each(cases)('$name', ({ source, expectedProblems }) => {
  const parse = parseProductRig(source, manifest)
  if (expectedProblems.length === 0) {
    expect(parse.kind).toBe('parsed')
    return
  }
  if (parse.kind !== 'broken') {
    throw new Error('the parse must report the broken tree as a value')
  }
  expect(parse.problems.map((problem) => ({ node: problem.node }))).toEqual(expectedProblems)
})

test('the parsed rig resolves every contract part the manifest and tree agree on', () => {
  const tree = validTree()
  const rig = parsedRig(sourceOf(tree))

  expect([...rig.parts.keys()]).toEqual(['PART_base', 'PART_body', 'PART_grille'])
  expect(rig.hotspots.map((hotspot) => ({ id: hotspot.id, part: hotspot.part.name }))).toEqual([
    { id: 'driver', part: 'PART_grille' },
    { id: 'shell', part: 'PART_body' },
  ])
  expect(rig.hotspots.map((hotspot) => hotspot.node.name)).toEqual(['HS_driver', 'HS_shell'])
  expect([...rig.cameras.keys()]).toEqual(['home', 'driver'])
  expect([...rig.cameras.values()].map((camera) => camera.name)).toEqual(['CAM_home', 'CAM_driver'])
  expect(rig.shadow.name).toBe('SHADOW')
  expect(rig.clip.name).toBe('Explode')
  expect(rig.variants).toEqual(['sage', 'graphite'])
  expect([...rig.anchorRest.keys()]).toEqual(['driver', 'shell'])
})

test('the rig summary is the plain data the store and the hook report', () => {
  const rig = parsedRig(sourceOf(validTree()))

  expect(summarizeProductRig(rig)).toEqual({
    parts: ['PART_base', 'PART_body', 'PART_grille'],
    hotspots: [
      { id: 'driver', part: 'PART_grille' },
      { id: 'shell', part: 'PART_body' },
    ],
    cameras: ['CAM_home', 'CAM_driver'],
    clip: { name: 'Explode', durationSeconds: 0.5 },
    variants: ['sage', 'graphite'],
  })
})

test.each([
  {
    name: 'the variants extension present',
    json: variantsJson(['sage', 'graphite']),
    expected: ['sage', 'graphite'],
  },
  { name: 'no extensions at all', json: {}, expected: [] },
  { name: 'no variants key', json: { extensions: {} }, expected: [] },
  { name: 'not an object', json: 'no json', expected: [] },
  {
    name: 'entries without names',
    json: { extensions: { KHR_materials_variants: { variants: [7] } } },
    expected: [],
  },
])('readVariantNames: $name', ({ json, expected }) => {
  expect(readVariantNames(json)).toEqual(expected)
})
