// The structure comparison, compared purely: the whole class of hotspot
// losses (lost, moved, duplicated, renamed) against findStructureLosses,
// without the CLI or a file.
import { describe, expect, it } from 'vitest'
import { findStructureLosses, type HotspotAnchor, type ProductStructure } from './structure.ts'
import type { GeometryFacts } from './modelFacts.ts'

// The geometry facts a structure fixture without shapes carries.
const noGeometry: GeometryFacts = {
  primitives: 0,
  primitivesNotTriangles: 0,
  primitivesWithoutPosition: 0,
  primitivesWithMorphTargets: 0,
  skins: 0,
  gpuInstancing: false,
  scenes: 0,
  nodeNamesOutsideScene: [],
}

// One anchor by name and part; the comparison reads no rest position.
function anchor(name: string, parentName: string | null): HotspotAnchor {
  return { name, parentName, restPosition: [0, 0, 0] }
}

function structureWith(hotspotAnchors: readonly HotspotAnchor[]): ProductStructure {
  return {
    nodeNames: hotspotAnchors.map((anchor) => anchor.name),
    hotspotAnchors: [...hotspotAnchors],
    cameraNames: [],
    variantNames: [],
    mappingCount: 0,
    animationNames: [],
    unlitMaterialNames: [],
    occlusionMaterialNames: [],
    meshoptCompressed: false,
    cameraFacts: [],
    meshBoxes: [],
    geometry: noGeometry,
  }
}

function lossesBetween(
  before: readonly HotspotAnchor[],
  after: readonly HotspotAnchor[],
): string[] {
  return findStructureLosses(structureWith(before), structureWith(after))
}

describe('findStructureLosses hotspot comparison', () => {
  it('reports nothing when every hotspot keeps its part', () => {
    const before: HotspotAnchor[] = [
      anchor('HS_dial', 'PART_base'),
      anchor('HS_grille', 'PART_base'),
    ]
    expect(lossesBetween(before, before)).toEqual([])
  })

  it('reports a hotspot moved to another part', () => {
    const losses = lossesBetween([anchor('HS_x', 'PART_a')], [anchor('HS_x', 'PART_b')])
    expect(losses).toEqual(['hotspot HS_x moved: was under PART_a, now under PART_b'])
  })

  it('reports a hotspot moved to the scene root', () => {
    const losses = lossesBetween([anchor('HS_x', 'PART_a')], [anchor('HS_x', null)])
    expect(losses).toEqual(['hotspot HS_x moved: was under PART_a, now under scene root'])
  })

  it('reports a hotspot lost from under its part', () => {
    const losses = lossesBetween([anchor('HS_x', 'PART_a')], [])
    expect(losses).toContainEqual('node name lost: HS_x')
    expect(losses).toContainEqual('hotspot lost: HS_x (was under PART_a)')
  })

  it('reports a renamed hotspot as a loss of the old name', () => {
    const losses = lossesBetween([anchor('HS_x', 'PART_a')], [anchor('HS_y', 'PART_a')])
    expect(losses).toContainEqual('node name lost: HS_x')
    expect(losses).toContainEqual('hotspot lost: HS_x (was under PART_a)')
  })

  it('reports a duplicated hotspot name in the output as its own violation', () => {
    const losses = lossesBetween(
      [anchor('HS_x', 'PART_a')],
      [anchor('HS_x', 'PART_a'), anchor('HS_x', 'PART_b')],
    )
    expect(losses).toEqual(['hotspot name duplicated in the output: HS_x appears 2 times'])
  })

  it('reports a duplicated hotspot name in the source as its own violation', () => {
    const losses = lossesBetween(
      [anchor('HS_x', 'PART_a'), anchor('HS_x', 'PART_b')],
      [anchor('HS_x', 'PART_a')],
    )
    expect(losses).toEqual(['hotspot name duplicated in the source: HS_x appears 2 times'])
  })

  it('reports the losses of several hotspots independently', () => {
    const losses = lossesBetween(
      [anchor('HS_x', 'PART_a'), anchor('HS_y', 'PART_b')],
      [anchor('HS_x', 'PART_c'), anchor('HS_y', 'PART_b')],
    )
    expect(losses).toEqual(['hotspot HS_x moved: was under PART_a, now under PART_c'])
  })
})
