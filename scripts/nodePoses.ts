// The posed world matrices of a document: every node's world matrix at the
// rest pose and at an animation's end key, the way a posed scene graph
// reads. The exploded-bounds reader and the home-fit facts both pose the
// same graph, so one walk serves both, and the local matrix product is the
// same one three composes a node's transform from.

import type { Document, Node } from '@gltf-transform/core'
import type { Mat4, Vec3 } from '../src/lib/camera/frame.ts'

// The local transform the clip's channels leave a node in at the last key:
// each path the channels drive, the rest of the node's own transform.
type EndLocal = {
  translation?: Vec3
  rotation?: readonly [number, number, number, number]
  scale?: Vec3
}

// Every node's world matrix, walked from each scene root, with the given
// channels' last-key transforms overriding the nodes they drive.
export function posedWorldMatricesOf(
  doc: Document,
  channels: readonly {
    readonly targetName: string
    readonly path: string
    readonly keyValues: readonly number[]
    readonly components: number
  }[],
): Map<Node, Mat4> {
  const overrides = endLocalsOf(channels)
  const worlds = new Map<Node, Mat4>()
  for (const scene of doc.getRoot().listScenes()) {
    for (const child of scene.listChildren()) {
      poseNode(child, IDENTITY, overrides, worlds)
    }
  }
  return worlds
}

// Each animated node's last-key local transform, by node name.
function endLocalsOf(
  channels: readonly {
    readonly targetName: string
    readonly path: string
    readonly keyValues: readonly number[]
    readonly components: number
  }[],
): Map<string, EndLocal> {
  const overrides = new Map<string, EndLocal>()
  for (const channel of channels) {
    const last = channel.keyValues.slice(channel.keyValues.length - channel.components)
    const override = overrides.get(channel.targetName) ?? {}
    if (channel.path === 'translation') {
      override.translation = [last[0] ?? 0, last[1] ?? 0, last[2] ?? 0]
    } else if (channel.path === 'rotation') {
      override.rotation = [last[0] ?? 0, last[1] ?? 0, last[2] ?? 0, last[3] ?? 1]
    } else if (channel.path === 'scale') {
      override.scale = [last[0] ?? 1, last[1] ?? 1, last[2] ?? 1]
    }
    overrides.set(channel.targetName, override)
  }
  return overrides
}

// Poses the node's world matrix and walks its subtree.
function poseNode(
  node: Node,
  parentWorld: Mat4,
  overrides: ReadonlyMap<string, EndLocal>,
  worlds: Map<Node, Mat4>,
): void {
  const world = multiplyMat4(parentWorld, endLocalMatrixOf(node, overrides))
  worlds.set(node, world)
  for (const child of node.listChildren()) {
    poseNode(child, world, overrides, worlds)
  }
}

// The node's local matrix at the posed end: the channels' last-key
// transform where they drive it, the node's own transform elsewhere.
function endLocalMatrixOf(node: Node, overrides: ReadonlyMap<string, EndLocal>): Mat4 {
  const override = node.getName() === '' ? undefined : overrides.get(node.getName())
  if (override === undefined) {
    return restLocalMatrixOf(node)
  }
  const translation = override.translation ?? vec3Of(node.getTranslation(), 0)
  const rotation = override.rotation ?? quaternionOf(node.getRotation())
  const scale = override.scale ?? vec3Of(node.getScale(), 1)
  return composeTRS(translation, rotation, scale)
}

function restLocalMatrixOf(node: Node): Mat4 {
  return composeTRS(
    vec3Of(node.getTranslation(), 0),
    quaternionOf(node.getRotation()),
    vec3Of(node.getScale(), 1),
  )
}

function vec3Of(values: readonly number[] | null, fallback: number): Vec3 {
  return [values?.[0] ?? fallback, values?.[1] ?? fallback, values?.[2] ?? fallback]
}

function quaternionOf(values: readonly number[] | null): readonly [number, number, number, number] {
  return [values?.[0] ?? 0, values?.[1] ?? 0, values?.[2] ?? 0, values?.[3] ?? 1]
}

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

// glTF's node matrix: T x R x S, column-major, the same product three
// composes a node's local transform from.
export function composeTRS(
  [tx, ty, tz]: Vec3,
  [x, y, z, w]: readonly [number, number, number, number],
  [sx, sy, sz]: Vec3,
): Mat4 {
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ]
}

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const at = (matrix: Mat4, index: number): number => matrix[index] ?? 0
  const out = new Array<number>(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        at(a, row) * at(b, column * 4) +
        at(a, 4 + row) * at(b, column * 4 + 1) +
        at(a, 8 + row) * at(b, column * 4 + 2) +
        at(a, 12 + row) * at(b, column * 4 + 3)
    }
  }
  return mat4Of(out)
}

// A column-major matrix from a computed 16-element array: the one place a
// built matrix becomes the fixed shape the frame math reads.
function mat4Of(v: readonly number[]): Mat4 {
  return [
    v[0] ?? 0,
    v[1] ?? 0,
    v[2] ?? 0,
    v[3] ?? 0,
    v[4] ?? 0,
    v[5] ?? 0,
    v[6] ?? 0,
    v[7] ?? 0,
    v[8] ?? 0,
    v[9] ?? 0,
    v[10] ?? 0,
    v[11] ?? 0,
    v[12] ?? 0,
    v[13] ?? 0,
    v[14] ?? 0,
    v[15] ?? 0,
  ]
}
