import type { Document } from '@gltf-transform/core'
import type { MappingList } from '@gltf-transform/extensions'
import { describe, expect, it } from 'vitest'
import { namedNode, preservationFixture } from './preservation.fixtures.ts'
import { findPreservationLosses, readProductPreservation } from './preservationCompare.ts'

function compare(before: Document, after: Document): string[] {
  return findPreservationLosses(readProductPreservation(before), readProductPreservation(after))
}

const changes: ReadonlyArray<readonly [string, (doc: Document) => void]> = [
  [
    'anchor world rest',
    (doc) => {
      namedNode(doc, 'HS_detail').setTranslation([10, 0, 0])
    },
  ],
  [
    'part rest pose',
    (doc) => {
      namedNode(doc, 'PART_body').setTranslation([10, 0, 0])
    },
  ],
  [
    'static part rest pose',
    (doc) => {
      namedNode(doc, 'PART_other').setTranslation([10, 0, 0])
    },
  ],
  [
    'camera ray origin',
    (doc) => {
      namedNode(doc, 'CAM_home').setTranslation([10, 0, 0])
    },
  ],
  [
    'camera ray direction',
    (doc) => {
      namedNode(doc, 'CAM_home').setRotation([0, 1, 0, 0])
    },
  ],
  [
    'camera lens',
    (doc) => {
      namedNode(doc, 'CAM_home').getCamera()?.setYFov(1)
    },
  ],
  [
    'camera clipping plane',
    (doc) => {
      namedNode(doc, 'CAM_home').getCamera()?.setZNear(0.5)
    },
  ],
  [
    'same-count variant assignment',
    (doc) => {
      const list = doc
        .getRoot()
        .listMeshes()[0]
        ?.listPrimitives()[0]
        ?.getExtension<MappingList>('KHR_materials_variants')
      list?.listMappings()[0]?.setMaterial(doc.getRoot().listMaterials()[1] ?? null)
    },
  ],
  [
    'clip target',
    (doc) => {
      doc
        .getRoot()
        .listAnimations()[0]
        ?.listChannels()[0]
        ?.setTargetNode(namedNode(doc, 'PART_other'))
    },
  ],
  [
    'clip timing',
    (doc) => {
      doc
        .getRoot()
        .listAnimations()[0]
        ?.listSamplers()[0]
        ?.getInput()
        ?.setArray(new Float32Array([0, 0.25, 0.5, 2]))
    },
  ],
  [
    'clip values',
    (doc) => {
      doc
        .getRoot()
        .listAnimations()[0]
        ?.listSamplers()[0]
        ?.getOutput()
        ?.setArray(new Float32Array(12))
    },
  ],
  [
    'clip interpolation',
    (doc) => {
      doc.getRoot().listAnimations()[0]?.listSamplers()[0]?.setInterpolation('STEP')
    },
  ],
]

describe('authored semantic preservation', () => {
  it.each(changes)('rejects a changed %s with names and counts intact', (_name, change) => {
    const before = preservationFixture()
    const after = preservationFixture()
    change(after)
    expect(compare(before, after)).not.toEqual([])
  })
  it('accepts identical authored semantics', () => {
    expect(compare(preservationFixture(), preservationFixture())).toEqual([])
  })
})
