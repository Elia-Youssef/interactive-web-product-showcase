import { Document, type Node } from '@gltf-transform/core'
import { KHRMaterialsVariants } from '@gltf-transform/extensions'

export function preservationFixture(): Document {
  const doc = new Document()
  doc.createBuffer()
  const scene = doc.createScene()
  const mesh = fixtureMesh(doc)
  const part = doc.createNode('PART_body').setMesh(mesh).setTranslation([0.013, 0.027, 0.039])
  part.addChild(doc.createNode('HS_detail').setTranslation([0.13, 0.25, 0.36]))
  scene.addChild(part)
  scene.addChild(doc.createNode('PART_other').setMesh(mesh))
  scene.addChild(
    doc
      .createNode('CAM_home')
      .setTranslation([0, 0.2, 2])
      .setCamera(
        doc
          .createCamera('home')
          .setType('perspective')
          .setYFov(0.45)
          .setAspectRatio(1600 / 1422),
      ),
  )
  addClip(doc, part)
  return doc
}

function fixtureMesh(doc: Document) {
  const buffer = doc.getRoot().listBuffers()[0]
  const variants = doc.createExtension(KHRMaterialsVariants)
  const finishes = [variants.createVariant('light'), variants.createVariant('dark')]
  const materials = [
    doc.createMaterial('MAT_light').setBaseColorFactor([0.8, 0.8, 0.8, 1]),
    doc.createMaterial('MAT_dark').setBaseColorFactor([0.1, 0.1, 0.1, 1]),
  ]
  const mesh = doc.createMesh('body')
  for (let slot = 0; slot < 2; slot += 1) {
    const position = doc
      .createAccessor()
      .setBuffer(buffer ?? null)
      .setType('VEC3')
      .setArray(new Float32Array([0.123, 0.234, 0.345, 0.423, 0.235, 0.346, 0.124, 0.534, 0.347]))
    const primitive = doc.createPrimitive().setAttribute('POSITION', position)
    primitive.setMaterial(materials[0] ?? null)
    const list = variants.createMappingList()
    for (const [index, finish] of finishes.entries()) {
      list.addMapping(
        variants
          .createMapping()
          .addVariant(finish)
          .setMaterial(materials[index] ?? null),
      )
    }
    primitive.setExtension('KHR_materials_variants', list)
    mesh.addPrimitive(primitive)
  }
  return mesh
}

function addClip(doc: Document, part: Node): void {
  const buffer = doc.getRoot().listBuffers()[0]
  const input = doc
    .createAccessor()
    .setBuffer(buffer ?? null)
    .setType('SCALAR')
    .setArray(new Float32Array([0, 0.25, 0.5, 1]))
  const output = doc
    .createAccessor()
    .setBuffer(buffer ?? null)
    .setType('VEC3')
    .setArray(
      new Float32Array([
        0.013, 0.027, 0.039, 0.033, 0.047, 0.059, 0.053, 0.067, 0.079, 0.213, 0.127, 0.139,
      ]),
    )
  const sampler = doc
    .createAnimationSampler()
    .setInput(input)
    .setOutput(output)
    .setInterpolation('LINEAR')
  doc
    .createAnimation('Explode')
    .addSampler(sampler)
    .addChannel(
      doc
        .createAnimationChannel()
        .setTargetNode(part)
        .setTargetPath('translation')
        .setSampler(sampler),
    )
}

export function namedNode(doc: Document, name: string): Node {
  const node = doc
    .getRoot()
    .listNodes()
    .find((node) => node.getName() === name)
  if (node === undefined) throw new Error(`missing fixture node ${name}`)
  return node
}
