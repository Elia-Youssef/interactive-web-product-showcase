// Facts retain authored identities while resolving geometry past quantize
// wrappers. Animation outputs include interpolation and cubic tangents.
import type { Document } from '@gltf-transform/core'
import { readCameraFacts } from './modelFacts.ts'
import { readPreservationPrimitives } from './preservationPrimitives.ts'
import { readPreservationTracks } from './preservationTracks.ts'
import { readPreservationRests } from './preservationRests.ts'

export type PreservationFacts = ReturnType<typeof readPreservationFacts>

export function readPreservationFacts(doc: Document) {
  const root = doc.getRoot()
  const tracks = readPreservationTracks(doc)
  const targets = new Set(tracks.map((track) => track.target))
  const rests = readPreservationRests(doc, targets)
  const cameras = readCameraFacts(doc).map((fact) => {
    const node = root
      .listNodes()
      .find((node) => node.getName() === fact.name && node.getCamera() !== null)
    const camera = node?.getCamera()
    if (camera === undefined || camera === null) throw new Error(`unreadable camera ${fact.name}`)
    return {
      ...fact,
      type: camera.getType(),
      near: camera.getZNear(),
      far: camera.getZFar(),
      xmag: camera.getXMag(),
      ymag: camera.getYMag(),
    }
  })
  const materialAliases = root.listMaterials().map((material) => ({
    name: material.getName(),
    aliases: root
      .listMaterials()
      .filter((other) => material.equals(other, new Set(['name'])))
      .map((other) => other.getName()),
  }))
  return { rests, cameras, primitives: readPreservationPrimitives(doc), tracks, materialAliases }
}
