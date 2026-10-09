import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { KHRTextureTransform } from '@gltf-transform/extensions'
import { createModelIO } from './modelIo.ts'
import { readShadowFacts } from './shadowFacts.ts'
import { buildDocument, nodeNamed } from './validateFixtures.ts'
import { rawAlphaKtx, rectangularAlpha, setShadowFixture } from './shadowProduct.fixtures.ts'
import { createShadowAlphaReader } from './shadowAlpha.ts'
import { alphaRegion } from './shadowFootprint.ts'
import { SHADOW_SETTINGS } from './shadowSettings.ts'

describe('shadow facts at the file boundary', () => {
  it('reads world floor axes through unnamed scaled and translated nodes', async () => {
    const doc = buildDocument()
    setShadowFixture(doc)
    const shadow = nodeNamed(doc, 'SHADOW')
    const mesh = shadow.getMesh()
    if (mesh === null) throw new Error('missing shadow mesh')
    shadow.setMesh(null).setTranslation([3, 2, -4])
    shadow.addChild(doc.createNode('').setScale([2, 1, 3]).setMesh(mesh))
    const facts = await readShadowFacts(doc)
    expect(facts.kind).toBe('measured')
    if (facts.kind !== 'measured') throw new Error(facts.reason)
    expect(facts.plane.boundsM.x[0]).toBe(3)
    expect(facts.plane.boundsM.y[0]).toBe(4)
    expect(facts.plane.boundsM.x[1]).toBeCloseTo(3.018962963)
    expect(facts.plane.boundsM.y[1]).toBeCloseTo(4.028444444)
    expect(facts.plane.uvBoundsM.y).toEqual([...facts.plane.boundsM.y].reverse())
  })

  it('reports missing images, degenerate UVs, transforms and corrupt KTX2 as problems', async () => {
    for (const broken of ['image', 'uv', 'transform', 'ktx'] as const) {
      const doc = buildDocument()
      setShadowFixture(doc)
      const primitive = nodeNamed(doc, 'SHADOW').getMesh()?.listPrimitives()[0]
      const material = primitive?.getMaterial()
      if (primitive === undefined || material === undefined || material === null)
        throw new Error('missing shadow')
      if (broken === 'image') material.setBaseColorTexture(null)
      if (broken === 'uv') primitive.getAttribute('TEXCOORD_0')?.setArray(new Float32Array(8))
      if (broken === 'ktx') material.getBaseColorTexture()?.setImage(new Uint8Array([1, 2, 3]))
      if (broken === 'transform') {
        const ext = doc.createExtension(KHRTextureTransform)
        material
          .getBaseColorTextureInfo()
          ?.setExtension('KHR_texture_transform', ext.createTransform().setScale([2, 2]))
      }
      expect(await readShadowFacts(doc), broken).toMatchObject({
        kind: 'problem',
        reason: expect.any(String),
      })
    }
  })

  it('decodes raw RGBA without changing alpha or row order', async () => {
    const grid = rectangularAlpha(8, 4, { x: [1, 5], y: [1, 3] })
    expect(await createShadowAlphaReader()(rawAlphaKtx(grid))).toEqual(grid)
  })

  it('decodes the shipped ETC1S mip zero to the recorded texel bounds', async () => {
    const io = await createModelIO()
    const doc = await io.read(
      fileURLToPath(new URL('../public/models/fjor-tast/model.glb', import.meta.url)),
    )
    const facts = await readShadowFacts(doc)
    expect(facts.kind).toBe('measured')
    if (facts.kind !== 'measured') throw new Error(facts.reason)
    expect([facts.grid.width, facts.grid.height]).toEqual([1024, 1024])
    expect(alphaRegion(facts.grid, SHADOW_SETTINGS.alphaThreshold)).toEqual({
      regionPx: { x: [11, 1014], y: [12, 1004] },
      edgeAlpha: 0,
    })
  })
})
