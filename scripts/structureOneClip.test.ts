// The one-clip rule without a name: exactly one animation, whatever it is
// called, the rule the optimize step's unnamed clips are checked by.
import { describe, expect, it } from 'vitest'
import type { GeometryFacts } from './modelFacts.ts'
import { findSingleAnimationViolations, type ProductStructure } from './structure.ts'

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
describe('the one-clip rule without a name', () => {
  const structureWith = (animationNames: string[]): ProductStructure => ({
    nodeNames: [],
    hotspotAnchors: [],
    cameraNames: [],
    variantNames: [],
    mappingCount: 0,
    animationNames,
    unlitMaterialNames: [],
    occlusionMaterialNames: [],
    meshoptCompressed: true,
    cameraFacts: [],
    meshBoxes: [],
    geometry: noGeometry,
  })

  it('passes on one animation of any name', () => {
    expect(findSingleAnimationViolations(structureWith(['Open up']))).toEqual([])
  })

  it('fails on zero animations', () => {
    expect(findSingleAnimationViolations(structureWith([]))).toEqual([
      'expected exactly one animation, found 0',
    ])
  })

  it('fails on two animations', () => {
    expect(findSingleAnimationViolations(structureWith(['Explode', 'Explode']))).toEqual([
      'expected exactly one animation, found 2',
    ])
  })
})
