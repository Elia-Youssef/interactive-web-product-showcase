// The structure suite: builds the contract's shapes in memory, runs the
// pipeline's geometry stage on them (everything except the KTX2 encode,
// which needs the system tool), and asserts nothing the site needs is lost.
// The negative control turns pruning on and shows the HS_ assertion fail,
// the reason the structure flags leave pruning off.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Document, type Node as GltfNode } from '@gltf-transform/core'
import {
  KHRMaterialsUnlit,
  KHRMaterialsVariants,
  type MappingList,
} from '@gltf-transform/extensions'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SUBPROCESS_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { runFixtureGltfCli } from './gltfCli.fixtures.ts'
import { createModelIO } from './modelIo.ts'
import { buildGeometryStageArgs } from './pipeline.ts'
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from './settings.ts'
import {
  findSingleAnimationViolations,
  findStructureLosses,
  nearestNamedAncestor,
  readProductStructure,
} from './structure.ts'

// One accessor of the given shape, attached to the document's buffer.
function accessorIn(
  doc: Document,
  shape: (
    accessor: ReturnType<Document['createAccessor']>,
  ) => ReturnType<Document['createAccessor']>,
): ReturnType<Document['createAccessor']> {
  const accessor = shape(doc.createAccessor())
  const buffer = doc.getRoot().listBuffers()[0]
  if (buffer !== undefined) {
    accessor.setBuffer(buffer)
  }
  return accessor
}

function vec3Accessor(doc: Document, values: number[]): ReturnType<Document['createAccessor']> {
  return accessorIn(doc, (accessor) => accessor.setType('VEC3').setArray(new Float32Array(values)))
}

function scalarAccessor(doc: Document, values: number[]): ReturnType<Document['createAccessor']> {
  return accessorIn(doc, (accessor) =>
    accessor.setType('SCALAR').setArray(new Float32Array(values)),
  )
}

function quadIndices(doc: Document): ReturnType<Document['createAccessor']> {
  return accessorIn(doc, (accessor) =>
    accessor.setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])),
  )
}

function addSceneNode(doc: Document, node: GltfNode): GltfNode {
  const scene = doc.getRoot().listScenes()[0]
  if (scene === undefined) {
    throw new Error('the fixture scene is missing')
  }
  scene.addChild(node)
  return node
}

function addPartMesh(doc: Document, name: string, positions: number[]): GltfNode {
  const mesh = doc.createMesh(name)
  const primitive = doc.createPrimitive()
  primitive.setAttribute('POSITION', vec3Accessor(doc, positions))
  primitive.setIndices(quadIndices(doc))
  mesh.addPrimitive(primitive)
  return addSceneNode(doc, doc.createNode(name).setMesh(mesh))
}

function addHotspots(doc: Document, partNode: GltfNode): GltfNode {
  // The unnamed wrapper stands in for the nodes quantization can add: the
  // hotspot parent must resolve past it, by name.
  const wrapper = doc.createNode()
  const hotspot = doc.createNode('HS_dial')
  wrapper.addChild(hotspot)
  partNode.addChild(wrapper)
  partNode.addChild(doc.createNode('HS_grille'))
  return hotspot
}

function addCameras(doc: Document): void {
  addSceneNode(doc, doc.createNode('CAM_home').setCamera(doc.createCamera('home')))
  addSceneNode(doc, doc.createNode('CAM_driver').setCamera(doc.createCamera('driver')))
}

function addShadow(doc: Document): void {
  const unlit = doc.createExtension(KHRMaterialsUnlit).createUnlit()
  const material = doc.createMaterial('shadow-unlit').setExtension('KHR_materials_unlit', unlit)
  const mesh = doc.createMesh('SHADOW')
  const primitive = doc.createPrimitive()
  primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]))
  primitive.setIndices(quadIndices(doc))
  primitive.setMaterial(material)
  mesh.addPrimitive(primitive)
  addSceneNode(doc, doc.createNode('SHADOW').setMesh(mesh))
}

function addVariants(doc: Document): void {
  const variants = doc.createExtension(KHRMaterialsVariants)
  const sage = variants.createVariant('sage')
  const graphite = variants.createVariant('graphite')
  const materials = [doc.createMaterial('body-sage'), doc.createMaterial('body-graphite')]
  const mesh = doc.createMesh('body-variants')
  const primitive = doc.createPrimitive()
  primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 2, 0, 0, 0, 2, 0, 2, 2, 0]))
  primitive.setIndices(quadIndices(doc))
  const mappingList: MappingList = variants.createMappingList()
  for (const [index, variant] of [sage, graphite].entries()) {
    const mapping = variants.createMapping()
    mapping.setMaterial(materials[index] ?? null)
    mapping.addVariant(variant)
    mappingList.addMapping(mapping)
  }
  primitive.setExtension('KHR_materials_variants', mappingList)
  mesh.addPrimitive(primitive)
  addSceneNode(doc, doc.createNode('PART_body').setMesh(mesh))
}

function addExplodeAnimation(doc: Document, target: GltfNode): void {
  const animation = doc.createAnimation('Explode')
  const sampler = doc.createAnimationSampler()
  sampler.setInput(scalarAccessor(doc, [0, 1]))
  sampler.setOutput(vec3Accessor(doc, [0, 0, 0, 0, 1, 0]))
  animation.addSampler(sampler)
  const channel = doc.createAnimationChannel()
  channel.setSampler(sampler)
  channel.setTargetNode(target)
  channel.setTargetPath('translation')
  animation.addChannel(channel)
}

function buildContractDocument(): { doc: Document; hotspotNode: GltfNode; partNode: GltfNode } {
  const doc = new Document()
  doc.createBuffer()
  doc.createScene('Scene')
  const partNode = addPartMesh(doc, 'PART_base', [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0])
  const hotspotNode = addHotspots(doc, partNode)
  addPartMesh(doc, 'PART_grille', [0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 4])
  addCameras(doc)
  addShadow(doc)
  addVariants(doc)
  addExplodeAnimation(doc, partNode)
  return { doc, hotspotNode, partNode }
}

async function runGeometryStage(
  sourcePath: string,
  outputPath: string,
  settings: OptimizeSettings,
): Promise<void> {
  const args = buildGeometryStageArgs(sourcePath, outputPath, settings)
  await runFixtureGltfCli(args)
}

describe('the geometry stage keeps the Blender contract', () => {
  let tempDir = ''
  let sourcePath = ''
  let before: ReturnType<typeof readProductStructure>
  let optimized: ReturnType<typeof readProductStructure>
  let pruned: ReturnType<typeof readProductStructure>

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'structure-test-'))
    sourcePath = path.join(tempDir, 'contract.glb')
    const { doc } = buildContractDocument()
    const io = await createModelIO()
    await io.write(sourcePath, doc)
    before = readProductStructure(await io.read(sourcePath))
    const optimizedPath = path.join(tempDir, 'contract-optimized.glb')
    await runGeometryStage(sourcePath, optimizedPath, DEFAULT_OPTIMIZE_SETTINGS)
    optimized = readProductStructure(await io.read(optimizedPath))
    const prunedPath = path.join(tempDir, 'contract-pruned.glb')
    await runGeometryStage(sourcePath, prunedPath, { ...DEFAULT_OPTIMIZE_SETTINGS, prune: true })
    pruned = readProductStructure(await io.read(prunedPath))
  }, SUBPROCESS_FIXTURE_TIMEOUT_MS)

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('reads the fixture back with every contract fact intact', () => {
    const structure = before
    expect(structure.nodeNames).toEqual(
      expect.arrayContaining([
        'PART_base',
        'HS_dial',
        'HS_grille',
        'CAM_home',
        'CAM_driver',
        'SHADOW',
        'PART_body',
      ]),
    )
    expect(structure.hotspotAnchors).toEqual([
      { name: 'HS_dial', parentName: 'PART_base', restPosition: [0, 0, 0] },
      { name: 'HS_grille', parentName: 'PART_base', restPosition: [0, 0, 0] },
    ])
    expect(structure.cameraNames).toEqual(['CAM_home', 'CAM_driver'])
    expect(structure.variantNames).toEqual(['sage', 'graphite'])
    expect(structure.mappingCount).toBe(2)
    expect(structure.animationNames).toEqual(['Explode'])
    expect(structure.unlitMaterialNames).toEqual(['shadow-unlit'])
    expect(structure.occlusionMaterialNames).toEqual([])
    expect(structure.meshoptCompressed).toBe(false)
  })

  it('resolves hotspot parents by name, past unnamed wrapper nodes', () => {
    const { hotspotNode, partNode } = buildContractDocument()
    expect(nearestNamedAncestor(hotspotNode)).toBe('PART_base')
    expect(nearestNamedAncestor(partNode)).toBeNull()
  })

  it('keeps every name, hotspot, camera, variant and mapping', () => {
    const after = optimized
    expect(after.nodeNames).toEqual(expect.arrayContaining(before.nodeNames))
    expect(after.hotspotAnchors).toEqual(before.hotspotAnchors)
    expect(after.cameraNames).toEqual(before.cameraNames)
    expect(after.variantNames).toEqual(before.variantNames)
    expect(after.mappingCount).toBe(before.mappingCount)
    expect(after.animationNames).toEqual(['Explode'])
    expect(after.meshoptCompressed).toBe(true)
    expect(findStructureLosses(before, after)).toEqual([])
    expect(findSingleAnimationViolations(after)).toEqual([])
  })

  it('loses the hotspots when pruning is on', () => {
    const after = pruned
    const losses = findStructureLosses(before, after)
    expect(losses).toEqual(expect.arrayContaining([expect.stringMatching(/hotspot lost: HS_dial/)]))
    expect(losses).toEqual(
      expect.arrayContaining([expect.stringMatching(/hotspot lost: HS_grille/)]),
    )
  })
})
