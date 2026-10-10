import { Document, type Mesh, type Node } from '@gltf-transform/core'
import { isMat4, transformPointOf } from '../src/lib/camera/frame.ts'

function multiply(a: readonly number[], b: readonly number[]): number[] {
  return Array.from({ length: 16 }, (_value, index) => {
    const row = index % 4
    const column = Math.floor(index / 4) * 4
    return (
      (b[column] ?? 0) * (a[row] ?? 0) +
      (b[column + 1] ?? 0) * (a[row + 4] ?? 0) +
      (b[column + 2] ?? 0) * (a[row + 8] ?? 0) +
      (b[column + 3] ?? 0) * (a[row + 12] ?? 0)
    )
  })
}

function volumeOf(mesh: Mesh) {
  const boxes = mesh
    .listPrimitives()
    .map((primitive) => primitive.getAttribute('POSITION'))
    .filter((position) => position !== null)
    .map((position) => ({ min: position.getMinNormalized([]), max: position.getMaxNormalized([]) }))
  if (boxes.length === 0) throw new Error('a preserved mesh has no position volume')
  const min = [0, 1, 2].map((axis) => Math.min(...boxes.map((box) => box.min[axis] ?? 0)))
  const max = [0, 1, 2].map((axis) => Math.max(...boxes.map((box) => box.max[axis] ?? 0)))
  const halfExtents = max.map((value, axis) => (value - (min[axis] ?? 0)) / 2)
  return {
    scale: Math.max(...halfExtents),
    offset: min.map((value, axis) => value + (halfExtents[axis] ?? 0)),
  }
}

function encodedMatrixOf(node: Node, mesh: Mesh): number[] {
  const volume = volumeOf(mesh)
  const local = node.getMatrix()
  if (!isMat4(local)) throw new Error('a preserved node has an unreadable local matrix')
  const offset = transformPointOf(local, [
    volume.offset[0] ?? 0,
    volume.offset[1] ?? 0,
    volume.offset[2] ?? 0,
  ])
  const remapped = local.map((value, index) =>
    index < 12 && index % 4 !== 3 ? value * volume.scale : value,
  )
  remapped.splice(12, 3, ...offset)
  if (!isMat4(remapped)) throw new Error('a quantization remap has an unreadable matrix')
  // quantize.ts folds this mesh volume remap into static leaf nodes and
  // setMatrix decomposes it to TRS. Reproduce that representation change
  // without allowing any change to the authored pose itself.
  const encodedLocal = new Document().createNode().setMatrix(remapped).getMatrix()
  const parent = node.getParentNode()
  return parent === null ? encodedLocal : multiply(parent.getWorldMatrix(), encodedLocal)
}

export function readPreservationRests(doc: Document, animatedTargets: ReadonlySet<string>) {
  return doc
    .getRoot()
    .listNodes()
    .filter((node) => node.getName() !== '')
    .map((node) => {
      const mesh = node.getMesh()
      const leafMesh =
        mesh !== null && node.listChildren().length === 0 && !animatedTargets.has(node.getName())
      const quantized =
        leafMesh &&
        mesh
          .listPrimitives()
          .every((primitive) => primitive.getAttribute('POSITION')?.getNormalized() === true)
      return {
        name: node.getName(),
        matrix: node.getWorldMatrix(),
        quantized,
        encodedMatrix: leafMesh ? encodedMatrixOf(node, mesh) : null,
      }
    })
}
