import { Document, type Mesh, type Primitive } from '@gltf-transform/core'

export const TETRA_POSITIONS = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]
export const TETRA_FACES = [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]
export type GeometryEncoding = 'indexed' | 'unindexed' | 'seams'

export function geometryDocument(): { doc: Document; mesh: Mesh } {
  const doc = new Document()
  doc.createBuffer()
  const mesh = doc.createMesh()
  doc.createScene().addChild(doc.createNode('PART_shape').setMesh(mesh))
  return { doc, mesh }
}

export function addTriangles(
  doc: Document,
  mesh: Mesh,
  positions: readonly number[],
  faces: readonly number[],
  encoding: GeometryEncoding,
): Primitive {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer()
  const expanded = faces.flatMap((vertex) => positions.slice(vertex * 3, vertex * 3 + 3))
  const primitive = doc.createPrimitive().setAttribute(
    'POSITION',
    doc
      .createAccessor()
      .setBuffer(buffer)
      .setType('VEC3')
      .setArray(new Float32Array(encoding === 'indexed' ? positions : expanded)),
  )
  if (encoding !== 'unindexed') {
    const indices = encoding === 'indexed' ? faces : faces.map((_, index) => index)
    primitive.setIndices(
      doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint16Array(indices)),
    )
  }
  mesh.addPrimitive(primitive)
  return primitive
}
