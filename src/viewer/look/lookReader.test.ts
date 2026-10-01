import { describe, expect, it } from 'vitest'
import { Mesh, MeshBasicMaterial, Scene, SRGBColorSpace, DataTexture } from 'three'
import { createLookReader } from './lookReader'

// The structural renderer stand-in the reader takes.
function stageRenderer(exposure: number): { toneMappingExposure: number } {
  return { toneMappingExposure: exposure }
}

function texturedMesh(name: string, map: DataTexture, aoMap: DataTexture): Mesh {
  const material = new MeshBasicMaterial({ map, aoMap })
  material.name = name
  return new Mesh(undefined, material)
}

describe('createLookReader', () => {
  it('reads the renderer and scene values live at access time', () => {
    const scene = new Scene()
    const gl = stageRenderer(1)
    const read = createLookReader(gl, scene, null, null)

    expect(read()).toEqual({
      exposure: 1,
      environmentIntensity: 1,
      environmentRotationDeg: 0,
      shadow: null,
      textures: null,
    })

    // The reader holds references, never values: later changes are what the
    // next read reports.
    gl.toneMappingExposure = 2.5
    scene.environmentIntensity = 0
    scene.environmentRotation.set(0, Math.PI, 0)
    expect(read()).toEqual({
      exposure: 2.5,
      environmentIntensity: 0,
      environmentRotationDeg: 180,
      shadow: null,
      textures: null,
    })
  })

  it('reads the shadow material state while a product is mounted', () => {
    const material = new MeshBasicMaterial()
    material.opacity = 0.4
    const read = createLookReader(stageRenderer(1), new Scene(), material, new Scene())

    expect(read().shadow).toEqual({
      opacity: 0.4,
      transparent: false,
      depthWrite: true,
    })

    // The material is read, not copied: the applied state is what the read
    // returns.
    material.transparent = true
    material.depthWrite = false
    material.opacity = 0.2
    expect(read().shadow).toEqual({
      opacity: 0.2,
      transparent: true,
      depthWrite: false,
    })
  })

  it('walks every material slot the product scene carries', () => {
    const map = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    map.colorSpace = SRGBColorSpace
    const aoMap = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1)
    const productScene = new Scene()
    productScene.add(texturedMesh('MAT_body', map, aoMap))
    const read = createLookReader(
      stageRenderer(1),
      new Scene(),
      new MeshBasicMaterial(),
      productScene,
    )

    expect(read().textures).toEqual([
      { material: 'MAT_body', slot: 'map', colorSpace: SRGBColorSpace },
      { material: 'MAT_body', slot: 'aoMap', colorSpace: '' },
    ])
  })
})
