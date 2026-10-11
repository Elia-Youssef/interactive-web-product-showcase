import { expect, test } from 'vitest'
import { finishEntryMaterialIndexes } from './variants'
import {
  duplicateMappingVariantMessage,
  invalidMappingMessage,
  missingMappingMaterialMessage,
  missingMappingVariantMessage,
  unknownMappingMaterialMessage,
  unknownMappingVariantMessage,
} from './contractDiagnostics'
import { brokenFinishProblems, plannedFinish } from './finishPlan.fixtures'

// The glTF JSON fixtures stand in for the parser JSON a load hands over:
// the tables are plain objects, so the plan's guards are exercised exactly
// as at runtime. The names follow the placeholder speaker, whose file these
// tables mirror.

const VARIANTS_JSON = {
  extensions: { KHR_materials_variants: { variants: [{ name: 'sage' }, { name: 'graphite' }] } },
}

function meshWith(material: number | null, mappings: unknown[] | null): unknown {
  const primitive: Record<string, unknown> = {}
  if (material !== null) {
    primitive.material = material
  }
  if (mappings !== null) {
    primitive.extensions = { KHR_materials_variants: { mappings } }
  }
  return { name: 'PART_test', primitives: [primitive] }
}

function mapping(material: number, variants: readonly number[]): unknown {
  return { material, variants: [...variants] }
}

function jsonWith(meshes: readonly unknown[], materials = 7): unknown {
  return {
    ...VARIANTS_JSON,
    materials: Array.from({ length: materials }, (_, index) => ({ name: `MAT_${index}` })),
    meshes: [...meshes],
  }
}

test('a file without the variants extension plans only the defaults', () => {
  const plan = plannedFinish({ meshes: [meshWith(2, null)], materials: [{ name: 'MAT_2' }] })

  expect(plan.variants).toEqual([])
  expect(plan.materialIndexes).toEqual(new Set([2]))
  expect(plan.primitives).toEqual([
    { mesh: 0, primitive: 0, defaultMaterial: 2, variantMaterials: new Map() },
  ])
})

test('every mapped primitive plans its default and the material of each variant', () => {
  const plan = plannedFinish(
    jsonWith([
      meshWith(0, [mapping(0, [0]), mapping(1, [1])]),
      meshWith(2, [mapping(2, [0]), mapping(3, [1])]),
    ]),
  )

  expect(plan.variants).toEqual(['sage', 'graphite'])
  expect(plan.primitives).toEqual([
    {
      mesh: 0,
      primitive: 0,
      defaultMaterial: 0,
      variantMaterials: new Map([
        [0, 0],
        [1, 1],
      ]),
    },
    {
      mesh: 1,
      primitive: 0,
      defaultMaterial: 2,
      variantMaterials: new Map([
        [0, 2],
        [1, 3],
      ]),
    },
  ])
  expect(plan.materialIndexes).toEqual(new Set([0, 1, 2, 3]))
})

test('a primitive without a mapping keeps its default under every variant', () => {
  const plan = plannedFinish(
    jsonWith([meshWith(0, [mapping(0, [0]), mapping(1, [1])]), meshWith(6, null)]),
  )

  expect(plan.primitives[1]).toEqual({
    mesh: 1,
    primitive: 0,
    defaultMaterial: 6,
    variantMaterials: new Map(),
  })
  expect(plan.materialIndexes).toEqual(new Set([0, 1, 6]))
})

test('one material shared by all the variants plans one mapping', () => {
  const plan = plannedFinish(jsonWith([meshWith(4, [mapping(4, [0, 1])])]))

  expect(plan.primitives[0]).toEqual({
    mesh: 0,
    primitive: 0,
    defaultMaterial: 4,
    variantMaterials: new Map([
      [0, 4],
      [1, 4],
    ]),
  })
  expect(plan.materialIndexes).toEqual(new Set([4]))
})

test('a partial mapping covers only the variants it names', () => {
  const plan = plannedFinish(jsonWith([meshWith(0, [mapping(1, [1])])]))

  expect(plan.primitives[0]?.variantMaterials).toEqual(new Map([[1, 1]]))
})

test('an entry can carry its default and every mapping material, each once', () => {
  const plan = plannedFinish(jsonWith([meshWith(4, [mapping(4, [0, 1])])]))
  const entry = plan.primitives[0]
  if (entry === undefined) {
    throw new Error('the fixture plan must carry an entry')
  }

  expect(finishEntryMaterialIndexes(entry)).toEqual([4])
  expect(
    finishEntryMaterialIndexes({
      ...entry,
      variantMaterials: new Map([
        [0, 5],
        [1, 4],
      ]),
    }),
  ).toEqual([4, 5])
})

test('a file without meshes plans the declared variants and nothing else', () => {
  const plan = plannedFinish(VARIANTS_JSON)

  expect(plan.variants).toEqual(['sage', 'graphite'])
  expect(plan.primitives).toEqual([])
  expect(plan.materialIndexes).toEqual(new Set())
})

test('a mapping naming an unknown variant index breaks naming the mesh and primitive', () => {
  expect(brokenFinishProblems(jsonWith([meshWith(0, [mapping(1, [2])])]))).toEqual([
    { mesh: 0, primitive: 0, message: unknownMappingVariantMessage(0, 2, 2) },
  ])
})

test('a mapping naming an unknown material index breaks naming the mesh and primitive', () => {
  expect(brokenFinishProblems(jsonWith([meshWith(0, [mapping(7, [0])])]))).toEqual([
    { mesh: 0, primitive: 0, message: unknownMappingMaterialMessage(0, 7, 7) },
  ])
})

test('every mapping problem is listed at once, each at its own primitive', () => {
  const problems = brokenFinishProblems(
    jsonWith([meshWith(0, [mapping(9, [0])]), meshWith(1, [mapping(1, [5])])]),
  )
  expect(problems).toHaveLength(2)
  expect(problems[0]?.mesh).toBe(0)
  expect(problems[1]?.mesh).toBe(1)
})

test('a mapping that names no material, no variant, or a taken variant breaks', () => {
  const problems = brokenFinishProblems(
    jsonWith([meshWith(0, [{}, mapping(1, []), mapping(2, [0]), mapping(3, [0, 0])])]),
  )
  expect(problems.map((problem) => problem.message)).toEqual([
    missingMappingMaterialMessage(0),
    missingMappingVariantMessage(1),
    duplicateMappingVariantMessage(3, 0),
  ])
})

// Every mapping branch carries owner copy through the real plan reader.
// Capitalization is a sentence rule independent of those owned words.
test.each([
  { kind: 'non-object', mappings: [null], message: invalidMappingMessage(0) },
  { kind: 'missing material', mappings: [{}], message: missingMappingMaterialMessage(0) },
  {
    kind: 'unknown material',
    mappings: [mapping(7, [0])],
    message: unknownMappingMaterialMessage(0, 7, 7),
  },
  {
    kind: 'missing variants',
    mappings: [{ material: 1 }],
    message: missingMappingVariantMessage(0),
  },
  { kind: 'empty variants', mappings: [mapping(1, [])], message: missingMappingVariantMessage(0) },
  ...['invalid', -1, 0.5, null].map((variant) => ({
    kind: `malformed variant ${String(variant)}`,
    mappings: [{ material: 1, variants: [variant] }],
    message: unknownMappingVariantMessage(0, variant, 2),
  })),
  {
    kind: 'unknown variant',
    mappings: [mapping(1, [2])],
    message: unknownMappingVariantMessage(0, 2, 2),
  },
  {
    kind: 'duplicate variant',
    mappings: [mapping(1, [0, 0])],
    message: duplicateMappingVariantMessage(0, 0),
  },
])('the $kind diagnostic is an owned sentence', ({ mappings, message }) => {
  const problems = brokenFinishProblems(jsonWith([meshWith(0, mappings)]))
  expect(problems).toEqual([{ mesh: 0, primitive: 0, message }])
  expect(problems[0]?.message.startsWith('The mapping at ')).toBe(true)
})

test('a malformed variants table breaks before any mapping is read', () => {
  expect(
    brokenFinishProblems({
      extensions: { KHR_materials_variants: { variants: [{ nope: true }] } },
      meshes: [meshWith(0, [mapping(1, [0])])],
    }),
  ).toEqual([{ mesh: null, primitive: null, message: 'the variant at 0 has no name' }])
})

test('a full mapping can dress a primitive that names no default material', () => {
  const plan = plannedFinish(jsonWith([meshWith(null, [mapping(1, [0, 1])])]))
  expect(plan.primitives[0]).toEqual({
    mesh: 0,
    primitive: 0,
    defaultMaterial: null,
    variantMaterials: new Map([
      [0, 1],
      [1, 1],
    ]),
  })
  expect(plan.materialIndexes).toEqual(new Set([1]))
})
