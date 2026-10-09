import { describe, expect, it } from 'vitest'
import { primitiveFacts } from './contractPrimitiveFacts.ts'
import { readContractModelFacts } from './contractFacts.ts'
import { materialRules } from './contractRuleMaterials.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'
import {
  addTriangles,
  geometryDocument,
  TETRA_FACES,
  TETRA_POSITIONS,
  type GeometryEncoding,
} from './contractGeometry.fixtures.ts'

const ENCODINGS: readonly GeometryEncoding[] = ['indexed', 'unindexed', 'seams']

describe('geometric primitive facts', () => {
  it.each(ENCODINGS)('a closed %s surface stays closed across material boundaries', (encoding) => {
    for (const split of [false, true]) {
      const { doc, mesh } = geometryDocument()
      const first = doc.createMaterial('first').setDoubleSided(true)
      const second = doc.createMaterial('second').setDoubleSided(true)
      const groups = split ? [TETRA_FACES.slice(0, 6), TETRA_FACES.slice(6)] : [TETRA_FACES]
      groups.forEach((faces, index) => {
        addTriangles(doc, mesh, TETRA_POSITIONS, faces, encoding).setMaterial(
          index === 0 ? first : second,
        )
      })
      const facts = primitiveFacts(doc)
      expect(facts.map((fact) => fact.openEdges)).toEqual(groups.map(() => false))
      expect(facts.map((fact) => fact.duplicateTriangles)).toEqual(groups.map(() => 0))
      const rule = materialRules.find((entry) => entry.key === 'single-sided-materials')
      if (rule === undefined) throw new Error('missing sidedness rule')
      expect(rule.check(contractRuleInputOf(doc)).violations).toHaveLength(groups.length)
    }
  })

  it.each(['unindexed', 'seams'] as const)(
    'coincident %s faces count with either winding and across primitives',
    (encoding) => {
      for (const reversed of [false, true]) {
        for (const split of [false, true]) {
          const { doc, mesh } = geometryDocument()
          const face = [0, 1, 2]
          const duplicate = reversed ? [2, 1, 0] : face
          const groups = split ? [face, duplicate] : [[...face, ...duplicate]]
          for (const faces of groups) addTriangles(doc, mesh, TETRA_POSITIONS, faces, encoding)
          expect(primitiveFacts(doc).map((fact) => fact.duplicateTriangles)).toEqual(
            split ? [0, 1] : [1],
          )
        }
      }
    },
  )

  it.each(ENCODINGS)(
    'a legitimate open %s sheet remains open with shared materials',
    (encoding) => {
      const { doc, mesh } = geometryDocument()
      const material = doc.createMaterial('shared').setDoubleSided(true)
      addTriangles(doc, mesh, TETRA_POSITIONS, [0, 1, 2], encoding).setMaterial(material)
      addTriangles(doc, mesh, TETRA_POSITIONS, [0, 3, 1], encoding).setMaterial(material)
      expect(primitiveFacts(doc).map((fact) => fact.openEdges)).toEqual([true, true])
      const rule = materialRules.find((entry) => entry.key === 'single-sided-materials')
      if (rule === undefined) throw new Error('missing sidedness rule')
      expect(rule.check(contractRuleInputOf(doc)).violations).toEqual([])
    },
  )

  it('does not weld independently placed mesh nodes together', () => {
    const { doc, mesh } = geometryDocument()
    addTriangles(doc, mesh, TETRA_POSITIONS, TETRA_FACES.slice(0, 6), 'indexed')
    const other = doc.createMesh()
    doc
      .getRoot()
      .listScenes()[0]
      ?.addChild(doc.createNode('PART_other').setMesh(other).setTranslation([2, 0, 0]))
    addTriangles(doc, other, TETRA_POSITIONS, TETRA_FACES.slice(6), 'indexed')
    expect(primitiveFacts(doc).map((fact) => fact.openEdges)).toEqual([true, true])
  })

  it('uses decoded normalized positions rather than their stored integer values', () => {
    const { doc, mesh } = geometryDocument()
    const first = addTriangles(doc, mesh, TETRA_POSITIONS, [0, 1, 2], 'unindexed')
    const position = first.getAttribute('POSITION')
    if (position === null) throw new Error('missing positions')
    position.setArray(new Int16Array([0, 0, 0, 32767, 0, 0, 0, 32767, 0])).setNormalized(true)
    addTriangles(doc, mesh, TETRA_POSITIONS, [0, 1, 2], 'unindexed')
    expect(readContractModelFacts(doc).primitives.map((fact) => fact.duplicateTriangles)).toEqual([
      0, 1,
    ])
  })
})
