import type { Primitive } from '@gltf-transform/core'

type Triangle = readonly [number, number, number]
export type PrimitiveTopology = {
  readonly openEdges: boolean
  readonly duplicateTriangles: number
}

// One mesh's welded surface: each primitive's place in it, and the count of
// triangles that collapsed when their corners welded together.
export type MeshTopology = {
  readonly primitives: readonly PrimitiveTopology[]
  readonly collapsedTriangles: number
}

// Primitives in one mesh share a coordinate system. Weld their decoded
// positions exactly so material boundaries and attribute seams do not
// become geometric boundaries. Different mesh nodes remain independent.
// A triangle whose corners weld to fewer than three distinct vertices has
// no area: it bounds no surface, so its edges join no incidence count and
// it is reported as a collapsed triangle of the mesh instead.
export function meshTopology(primitives: readonly Primitive[]): MeshTopology {
  const vertices = new Map<string, number>()
  const triangles = primitives.map((primitive) => weldedTriangles(primitive, vertices))
  const uses = new Map<string, number>()
  let collapsedTriangles = 0
  for (const primitiveTriangles of triangles) {
    for (const triangle of primitiveTriangles) {
      if (isCollapsed(triangle)) {
        collapsedTriangles += 1
        continue
      }
      for (const edge of edgesOf(triangle)) uses.set(edge, (uses.get(edge) ?? 0) + 1)
    }
  }
  const seen = new Set<string>()
  return {
    primitives: triangles.map((primitiveTriangles) => {
      let duplicateTriangles = 0
      for (const triangle of primitiveTriangles) {
        const key = [...triangle].sort((a, b) => a - b).join(',')
        if (seen.has(key)) duplicateTriangles += 1
        seen.add(key)
      }
      return {
        openEdges: primitiveTriangles.some(
          (triangle) =>
            !isCollapsed(triangle) && edgesOf(triangle).some((edge) => uses.get(edge) === 1),
        ),
        duplicateTriangles,
      }
    }),
    collapsedTriangles,
  }
}

function edgesOf([a, b, c]: Triangle): readonly string[] {
  return [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`
}

// Fewer than three distinct welded corners: the triangle has no area.
function isCollapsed([a, b, c]: Triangle): boolean {
  return a === b || b === c || a === c
}

function weldedTriangles(primitive: Primitive, vertices: Map<string, number>): readonly Triangle[] {
  const position = primitive.getAttribute('POSITION')
  if (position === null || primitive.getMode() !== 4) return []
  const vertexIds: number[] = []
  for (let vertex = 0; vertex < position.getCount(); vertex += 1) {
    const key = position.getElement(vertex, []).join(',')
    let id = vertices.get(key)
    if (id === undefined) {
      id = vertices.size
      vertices.set(key, id)
    }
    vertexIds.push(id)
  }
  const indices = primitive.getIndices()
  const count = indices?.getCount() ?? position.getCount()
  const vertexAt = (at: number): number => {
    const index = indices === null ? at : indices.getScalar(at)
    const id = vertexIds[index]
    if (id === undefined) throw new Error(`triangle index ${index} has no decoded position`)
    return id
  }
  const triangles: Triangle[] = []
  for (let at = 0; at + 2 < count; at += 3) {
    triangles.push([vertexAt(at), vertexAt(at + 1), vertexAt(at + 2)])
  }
  return triangles
}
