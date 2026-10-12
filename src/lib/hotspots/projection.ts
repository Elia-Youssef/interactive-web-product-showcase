// The projection of a world point into stage CSS pixels, for the hotspot
// markers: a point on the stage, given by the camera's view and projection
// matrices and the stage box, in CSS pixels from the box's top-left with y
// running down. The matrices are plain column-major 16-element arrays, the
// layout three's Matrix4.elements hands over, so the lib stays free of any
// scene graph and the viewer passes its live matrices through unchanged.
//
// Every answer is written into a caller-owned target, so a per-frame caller
// reuses its storage and allocates nothing. The one projection math both
// public functions use is the clip space transform, itself written into a
// caller-owned scratch. The math is exact; rounding belongs to the display,
// if anywhere.

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

// The stage projection's mutable target: structurally a StageProjection,
// filled per call so a per-frame caller reuses one record.
export type StageProjectionTarget = {
  x: number
  y: number
  inFront: boolean
}

// The clip space position's mutable scratch, shared by both projections.
export type ClipSpaceTarget = {
  x: number
  y: number
  w: number
}

// The one projection math: a world point through the camera's view and
// projection matrices into clip space. A perspective camera looks down its
// view space -Z, so the clip w of the standard projection is -viewZ:
// positive exactly when the point is in front of the camera.
export function projectToClipSpace(
  x: number,
  y: number,
  z: number,
  camera: CameraMatrices,
  target: ClipSpaceTarget,
): void {
  const view = camera.viewMatrix
  // The view-space point: the world point through the world-to-camera
  // matrix, whose translation rides in the matrix's fourth column.
  const viewX = at(view, 0) * x + at(view, 4) * y + at(view, 8) * z + at(view, 12)
  const viewY = at(view, 1) * x + at(view, 5) * y + at(view, 9) * z + at(view, 13)
  const viewZ = at(view, 2) * x + at(view, 6) * y + at(view, 10) * z + at(view, 14)
  const p = camera.projectionMatrix
  target.x = at(p, 0) * viewX + at(p, 4) * viewY + at(p, 8) * viewZ + at(p, 12)
  target.y = at(p, 1) * viewX + at(p, 5) * viewY + at(p, 9) * viewZ + at(p, 13)
  target.w = at(p, 3) * viewX + at(p, 7) * viewY + at(p, 11) * viewZ + at(p, 15)
}

// Projects one world point through the camera's matrices into stage CSS
// pixels from the stage box's top-left, and reports whether the point
// stands in front of the camera.
export function projectToStage(
  point: WorldPoint,
  camera: CameraMatrices,
  stage: StageBox,
  target: StageProjectionTarget,
  clip: ClipSpaceTarget,
): void {
  projectToClipSpace(point.x, point.y, point.z, camera, clip)
  const inFront = clip.w > 0
  const ndcX = clip.x / clip.w
  const ndcY = clip.y / clip.w
  target.x = ((ndcX + 1) / 2) * stage.width
  target.y = ((1 - ndcY) / 2) * stage.height
  target.inFront = inFront
}

// A world-space axis-aligned box: the extent of a subject on the stage, as
// the rig or a bounding-volume measurement answers it.
export type WorldBox = {
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number
}

// The screen extent a projection fills, mutable so a per-frame caller
// reuses one target instead of allocating. Structurally a StageRect.
export type StageRectTarget = {
  left: number
  top: number
  right: number
  bottom: number
}

// The screen extent of a world box: the axis-aligned stage rect that covers
// the projections of the box's eight corners, filled into the target. A box
// the camera looks through can have corners behind its plane, whose
// projections mean nothing; only the corners in front answer, and a box with
// none of them in front is not on the stage and answers false.
export function projectBoxExtent(
  box: WorldBox,
  camera: CameraMatrices,
  stage: StageBox,
  target: StageRectTarget,
  clip: ClipSpaceTarget,
): boolean {
  let seen = false
  for (let corner = 0; corner < 8; corner += 1) {
    const x = (corner & 1) === 0 ? box.minX : box.maxX
    const y = (corner & 2) === 0 ? box.minY : box.maxY
    const z = (corner & 4) === 0 ? box.minZ : box.maxZ
    projectToClipSpace(x, y, z, camera, clip)
    if (clip.w <= 0) {
      continue
    }
    const sx = ((clip.x / clip.w + 1) / 2) * stage.width
    const sy = ((1 - clip.y / clip.w) / 2) * stage.height
    if (!seen) {
      target.left = sx
      target.right = sx
      target.top = sy
      target.bottom = sy
      seen = true
      continue
    }
    target.left = Math.min(target.left, sx)
    target.right = Math.max(target.right, sx)
    target.top = Math.min(target.top, sy)
    target.bottom = Math.max(target.bottom, sy)
  }
  return seen
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
