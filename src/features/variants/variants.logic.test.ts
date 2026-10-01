import { expect, test } from 'vitest'
import { readFinishPlan, type FinishPlan } from '@lib/product'
import {
  finishMaterialIndex,
  finishPrimitiveKey,
  mappedFinishEntries,
  precompilePairs,
} from './variants.logic'

// The plan tables mirror the placeholder speaker's file: two variants, a
// per-variant mapping on base and body, one material shared by both
// variants on grille and knob, and an unmapped mesh.
function speakerPlan(): FinishPlan {
  return readFinishPlan({
    extensions: { KHR_materials_variants: { variants: [{ name: 'sage' }, { name: 'graphite' }] } },
    materials: Array.from({ length: 7 }, (_, index) => ({ name: `MAT_${index}` })),
    meshes: [
      {
        name: 'PART_base',
        primitives: [
          {
            material: 0,
            extensions: {
              KHR_materials_variants: {
                mappings: [
                  { material: 0, variants: [0] },
                  { material: 1, variants: [1] },
                ],
              },
            },
          },
        ],
      },
      {
        name: 'PART_grille',
        primitives: [
          {
            material: 4,
            extensions: {
              KHR_materials_variants: { mappings: [{ material: 4, variants: [0, 1] }] },
            },
          },
        ],
      },
      { name: 'SHADOW', primitives: [{ material: 6 }] },
    ],
  })
}

test('a finish key names the mesh and the primitive the file declares', () => {
  expect(finishPrimitiveKey(2, 0)).toBe('2:0')
  expect(finishPrimitiveKey(0, 1)).toBe('0:1')
})

test('only the mapped entries of a plan are reachable by a switch', () => {
  const plan = speakerPlan()

  expect(mappedFinishEntries(plan).map((entry) => entry.mesh)).toEqual([0, 1])
})

test('a mapped entry carries the mapping material of its variant', () => {
  const [base] = mappedFinishEntries(speakerPlan())
  if (base === undefined) {
    throw new Error('the fixture plan must map a base')
  }

  expect(finishMaterialIndex(base, 0)).toBe(0)
  expect(finishMaterialIndex(base, 1)).toBe(1)
})

test('a shared material entry carries the same index under every variant', () => {
  const entries = mappedFinishEntries(speakerPlan())
  const grille = entries[1]
  if (grille === undefined) {
    throw new Error('the fixture plan must map a grille')
  }

  expect(finishMaterialIndex(grille, 0)).toBe(4)
  expect(finishMaterialIndex(grille, 1)).toBe(4)
})

test('a variant a mapping omits keeps the primitive default', () => {
  const plan = readFinishPlan({
    extensions: { KHR_materials_variants: { variants: [{ name: 'sage' }, { name: 'graphite' }] } },
    materials: [{ name: 'A' }, { name: 'B' }],
    meshes: [
      {
        name: 'PART_partial',
        primitives: [
          {
            material: 0,
            extensions: { KHR_materials_variants: { mappings: [{ material: 1, variants: [1] }] } },
          },
        ],
      },
    ],
  })

  const entry = mappedFinishEntries(plan)[0]
  if (entry === undefined) {
    throw new Error('the fixture plan must map an entry')
  }

  expect(finishMaterialIndex(entry, 0)).toBe(0)
})

test('a mapped entry without a default and without the variant fails instead of guessing', () => {
  const plan = readFinishPlan({
    extensions: { KHR_materials_variants: { variants: [{ name: 'sage' }, { name: 'graphite' }] } },
    materials: [{ name: 'B' }],
    meshes: [
      {
        name: 'PART_partial',
        primitives: [
          {
            extensions: { KHR_materials_variants: { mappings: [{ material: 0, variants: [0] }] } },
          },
        ],
      },
    ],
  })
  const entry = mappedFinishEntries(plan)[0]
  if (entry === undefined) {
    throw new Error('the fixture plan must map an entry')
  }

  expect(() => finishMaterialIndex(entry, 1)).toThrow(
    'mesh 0 primitive 0 carries no material for the variant 1',
  )
})

test('the precompile pairs cover every mapped mesh with every material it could wear', () => {
  const pairs = precompilePairs(speakerPlan())

  expect(pairs).toEqual([
    { mesh: 0, materialIndex: 0 },
    { mesh: 0, materialIndex: 1 },
    { mesh: 1, materialIndex: 4 },
  ])
})

test('a precompile pair set never borrows the geometry of another mesh', () => {
  const pairs = precompilePairs(speakerPlan())

  expect(pairs.some((pair) => pair.mesh === 1 && pair.materialIndex === 0)).toBe(false)
  expect(pairs.some((pair) => pair.mesh === 0 && pair.materialIndex === 4)).toBe(false)
})
