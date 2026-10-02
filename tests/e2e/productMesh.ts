import type { Document, Node as GltfNode, vec3 } from '@gltf-transform/core'

// The occluding meshes of a shipped model, read in Node for the hotspot
// facts: their stage-space triangles and their union bounds. The shadow
// subtree is excluded, the same set the runtime's occluder collection walks,
// so the facts' raycasts see what the runtime's occluder raycasts see.

export type Triangle = readonly [vec3, vec3, vec3]

export type OccluderMeshes = {
  readonly triangles: readonly Triangle[]
  readonly min: vec3
  readonly max: vec3
}

// Reads every occluding mesh of the document, transformed into stage space
// (the centered model at the given center).
export function readOccluderMeshes(doc: Document, center: vec3): OccluderMeshes {
  const root = doc.getRoot()
  const triangles: Triangle[] = []
  const min: vec3 = [Infinity, Infinity, Infinity]
  const max: vec3 = [-Infinity, -Infinity, -Infinity]
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (mesh === null) {
      continue
    }
    if (isUnderShadow(node)) {
      continue
    }
    readMeshTriangles(node, mesh, center, triangles, min, max)
  }
  return { triangles, min, max }
}

// Reads one mesh's primitives into stage-space triangles, growing the
// running union bounds.
function readMeshTriangles(
  node: GltfNode,
  mesh: NonNullable<ReturnType<GltfNode['getMesh']>>,
  center: vec3,
  triangles: Triangle[],
  min: vec3,
  max: vec3,
): void {
  const world = node.getWorldMatrix()
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION')
    if (position === null) {
      throw new Error('a shipped mesh primitive carries no POSITION accessor')
    }
    const indices = primitive.getIndices()
    const count = indices !== null ? indices.getCount() : position.getCount()
    const readVertex = (index: number): vec3 => {
      const v = position.getElement(index, [0, 0, 0])
      const x = v[0]
      const y = v[1]
      const z = v[2]
      if (x === undefined || y === undefined || z === undefined) {
        throw new Error('a POSITION element of a shipped mesh arrived short')
      }
      return [
        world[0] * x + world[4] * y + world[8] * z + world[12] - center[0],
        world[1] * x + world[5] * y + world[9] * z + world[13] - center[1],
        world[2] * x + world[6] * y + world[10] * z + world[14] - center[2],
      ]
    }
    for (let face = 0; face < count; face += 3) {
      const a = readVertex(indices !== null ? indices.getScalar(face) : face)
      const b = readVertex(indices !== null ? indices.getScalar(face + 1) : face + 1)
      const c = readVertex(indices !== null ? indices.getScalar(face + 2) : face + 2)
      for (const vertex of [a, b, c]) {
        min[0] = Math.min(min[0], vertex[0])
        min[1] = Math.min(min[1], vertex[1])
        min[2] = Math.min(min[2], vertex[2])
        max[0] = Math.max(max[0], vertex[0])
        max[1] = Math.max(max[1], vertex[1])
        max[2] = Math.max(max[2], vertex[2])
      }
      triangles.push([a, b, c])
    }
  }
}

function isUnderShadow(node: GltfNode): boolean {
  let current: GltfNode | null = node
  while (current !== null) {
    if (current.getName() === 'SHADOW') {
      return true
    }
    current = current.getParentNode()
  }
  return false
}

// Whether any mesh triangle crosses the segment from the origin to the
// anchor strictly before it. No epsilon, like the runtime rule: a hit at the
// anchor's own distance does not block it.
export function isBlocked(origin: vec3, anchor: vec3, triangles: readonly Triangle[]): boolean {
  const toAnchor = subtract(anchor, origin)
  const anchorDistance = length(toAnchor)
  const direction = normalize(toAnchor)
  for (const [a, b, c] of triangles) {
    const distance = rayTriangleDistance(origin, direction, a, b, c)
    if (distance !== null && distance < anchorDistance) {
      return true
    }
  }
  return false
}

// Moeller-Trumbore, over the stage-space triangles: the distance along the
// ray of the hit, or null.
function rayTriangleDistance(
  origin: vec3,
  direction: vec3,
  a: vec3,
  b: vec3,
  c: vec3,
): number | null {
  const edge1 = subtract(b, a)
  const edge2 = subtract(c, a)
  const p = cross(direction, edge2)
  const det = dot(edge1, p)
  if (Math.abs(det) < 1e-12) {
    return null
  }
  const invDet = 1 / det
  const toOrigin = subtract(origin, a)
  const u = invDet * dot(toOrigin, p)
  if (u < 0 || u > 1) {
    return null
  }
  const q = cross(toOrigin, edge1)
  const v = invDet * dot(direction, q)
  if (v < 0 || u + v > 1) {
    return null
  }
  const distance = invDet * dot(edge2, q)
  return distance > 1e-9 ? distance : null
}

function subtract(a: vec3, b: vec3): vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function dot(a: vec3, b: vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: vec3, b: vec3): vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function length(a: vec3): number {
  return Math.hypot(a[0], a[1], a[2])
}

function normalize(a: vec3): vec3 {
  const l = length(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
