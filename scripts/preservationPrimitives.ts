import type { Document, Mesh, Node, Primitive } from '@gltf-transform/core'
import type { MappingList } from '@gltf-transform/extensions'
import { isMat4, transformPointOf } from '../src/lib/camera/frame.ts'
import { positionComponentBound } from './preservationPositionBounds.ts'
import { normalizedScaleOf, primitiveBox } from './modelFacts.ts'
import { materialFactOf } from './preservationMaterials.ts'

function ownerName(node: Node): string {
  let owner: Node | null = node
  while (owner !== null && owner.getName() === '') owner = owner.getParentNode()
  if (owner === null) throw new Error('a preserved primitive has no named owner')
  return owner.getName()
}

function meshHalfExtent(mesh: Mesh): number {
  const boxes = mesh
    .listPrimitives()
    .map(primitiveBox)
    .filter((box) => box !== null)
  if (boxes.length === 0) throw new Error('a preserved mesh has no positions')
  return Math.max(
    ...[0, 1, 2].map(
      (axis) =>
        (Math.max(...boxes.map((box) => box.max[axis] ?? 0)) -
          Math.min(...boxes.map((box) => box.min[axis] ?? 0))) /
        2,
    ),
  )
}

function worldBounds(node: Node, primitive: Primitive) {
  const position = primitive.getAttribute('POSITION')
  if (position === null || position.getArray() === null)
    throw new Error('a preserved primitive has unreadable positions')
  const matrix = node.getWorldMatrix()
  if (!isMat4(matrix)) throw new Error('a preserved primitive has an unreadable world matrix')
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const values = position.getArray() ?? []
  const scale = normalizedScaleOf(position)
  const indices =
    primitive.getIndices()?.getArray() ??
    Array.from({ length: position.getCount() }, (_value, index) => index)
  for (const index of indices) {
    const point = transformPointOf(matrix, [
      (values[index * 3] ?? NaN) * scale,
      (values[index * 3 + 1] ?? NaN) * scale,
      (values[index * 3 + 2] ?? NaN) * scale,
    ])
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis] ?? Infinity, point[axis] ?? NaN)
      max[axis] = Math.max(max[axis] ?? -Infinity, point[axis] ?? NaN)
    }
  }
  return { values: [...min, ...max], matrix }
}

function primitiveFact(doc: Document, node: Node, mesh: Mesh, primitive: Primitive, key: string) {
  const bounds = worldBounds(node, primitive)
  // quantize.ts remaps positions to [-1,1] in float32, rounds at the
  // shared position bits, then replicates bits into normalized Int16. These
  // three storage steps bound each local component; the absolute world
  // basis transports that bound into each world axis.
  const localBound = positionComponentBound(meshHalfExtent(mesh))
  const positionBounds = [0, 1, 2].map(
    (axis) =>
      localBound *
      (Math.abs(bounds.matrix[axis] ?? 0) +
        Math.abs(bounds.matrix[axis + 4] ?? 0) +
        Math.abs(bounds.matrix[axis + 8] ?? 0)),
  )
  const mappings = primitive.getExtension<MappingList>('KHR_materials_variants')
  const assignments =
    mappings?.listMappings().flatMap((mapping) =>
      mapping.listVariants().map((variant) => ({
        variant: variant.getName(),
        material: materialFactOf(doc, mapping.getMaterial()),
      })),
    ) ?? []
  return {
    key,
    bounds: bounds.values,
    positionBounds,
    material: materialFactOf(doc, primitive.getMaterial()),
    assignments,
  }
}

export function readPreservationPrimitives(doc: Document) {
  const facts: ReturnType<typeof primitiveFact>[] = []
  const ordinals = new Map<string, number>()
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (mesh === null) continue
    const owner = ownerName(node)
    for (const primitive of mesh.listPrimitives()) {
      const ordinal = ordinals.get(owner) ?? 0
      ordinals.set(owner, ordinal + 1)
      facts.push(primitiveFact(doc, node, mesh, primitive, `${owner}:${ordinal}`))
    }
  }
  return facts
}
