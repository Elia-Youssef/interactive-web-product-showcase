import { Raycaster, type Intersection, type Mesh, type Vector3 } from 'three'
import { isOccluded } from '@lib/hotspots/visibility'
import { aimRay } from './aimRay'

// The segment test shared by marker placement and model facts. Mesh.raycast
// owns intersection arithmetic and material face-side semantics. Scratch
// storage belongs to each reader, so the presented-frame path allocates none.
export class AnchorOcclusion {
  private readonly raycaster = new Raycaster()
  private readonly hits: Intersection[] = []

  isBlocked(origin: Vector3, anchor: Vector3, meshes: Mesh[]): boolean {
    const distance = aimRay(this.raycaster, origin, anchor)
    this.hits.length = 0
    this.raycaster.intersectObjects(meshes, false, this.hits)
    const nearest = this.hits[0]
    return isOccluded(distance, nearest === undefined ? null : nearest.distance)
  }
}
