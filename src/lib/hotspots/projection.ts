// The projection of a world point into stage CSS pixels, for the hotspot
// markers: a point on the stage, given by the camera's view and projection
// matrices and the stage box, in CSS pixels from the box's top-left with y
// running down. The matrices are plain column-major 16-element arrays, the
// layout three's Matrix4.elements hands over, so the lib stays free of any
// scene graph and the viewer passes its live matrices through unchanged.
//
// The math is exact; rounding belongs to the display, if anywhere.

export type WorldPoint = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type CameraMatrices = {
  // The camera's world-to-camera matrix (three's matrixWorldInverse).
  readonly viewMatrix: ReadonlyArray<number>
  // The camera's projection matrix.
  readonly projectionMatrix: ReadonlyArray<number>
}

// The stage box in CSS pixels: the box the canvas is shown in.
export type StageBox = {
  readonly width: number
  readonly height: number
}

export type StageProjection = {
  // CSS pixels from the stage box's top-left. Meaningful only while inFront;
  // a point on the camera plane divides by zero, and its coordinates are
  // never read because the visibility rule hides it.
  readonly x: number
  readonly y: number
  // The point stands in front of the camera plane, so the projection has a
  // positive clip w and answers the screen position.
  readonly inFront: boolean
}

// Projects one world point through the camera's view and projection matrices
// into stage CSS pixels from the stage box's top-left, and reports whether
// the point stands in front of the camera. A perspective camera looks down
// its view space -Z, so the clip w of the standard projection is -viewZ:
// positive exactly when the point is in front.
export function projectToStage(
  point: WorldPoint,
  camera: CameraMatrices,
  stage: StageBox,
): StageProjection {
  const view = viewTransform(point, camera.viewMatrix)
  const p = camera.projectionMatrix
  const clipX = at(p, 0) * view.x + at(p, 4) * view.y + at(p, 8) * view.z + at(p, 12)
  const clipY = at(p, 1) * view.x + at(p, 5) * view.y + at(p, 9) * view.z + at(p, 13)
  const clipW = at(p, 3) * view.x + at(p, 7) * view.y + at(p, 11) * view.z + at(p, 15)
  const inFront = clipW > 0
  const ndcX = clipX / clipW
  const ndcY = clipY / clipW
  return {
    x: ((ndcX + 1) / 2) * stage.width,
    y: ((1 - ndcY) / 2) * stage.height,
    inFront,
  }
}

// The view-space point: the world point through the world-to-camera matrix.
// The view translation rides in the matrix's fourth column.
function viewTransform(
  point: WorldPoint,
  view: ReadonlyArray<number>,
): { readonly x: number; readonly y: number; readonly z: number; readonly w: number } {
  return {
    x: at(view, 0) * point.x + at(view, 4) * point.y + at(view, 8) * point.z + at(view, 12),
    y: at(view, 1) * point.x + at(view, 5) * point.y + at(view, 9) * point.z + at(view, 13),
    z: at(view, 2) * point.x + at(view, 6) * point.y + at(view, 10) * point.z + at(view, 14),
    w: at(view, 3) * point.x + at(view, 7) * point.y + at(view, 11) * point.z + at(view, 15),
  }
}

// One matrix element, at the row-major offset the column-major storage puts
// it: index = column * 4 + row. A matrix that arrives short is a broken
// caller and fails loudly here, once, instead of computing with undefined.
function at(matrix: ReadonlyArray<number>, index: number): number {
  const value = matrix[index]
  if (value === undefined) {
    throw new Error(`a camera matrix arrived with no element at ${index}`)
  }
  return value
}

// The projection sits inside the stage box, edges included: a marker whose
// center lands exactly on the box edge is still on the stage. The bounds are
// the same box the projection's pixels are measured from.
export function isInsideStageBox(projection: StageProjection, stage: StageBox): boolean {
  return (
    projection.x >= 0 &&
    projection.x <= stage.width &&
    projection.y >= 0 &&
    projection.y <= stage.height
  )
}
