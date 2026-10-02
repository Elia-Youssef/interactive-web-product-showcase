// The lens a camera plan presents, as pure math: every view's authored
// vertical fov rides the controls' zoom channel as the zoom factor that
// turns the plan's base lens into the view's, and the whole plan shares
// one clip range so no eased move between views clips mid-way. Exact
// values, no rounding: the display rounds, never this module.

// The zoom factor that presents a view lens through a base lens: the
// tangent half-angle ratio, which is the zoom three's perspective
// projection composes with the fov (PerspectiveCamera.getEffectiveFOV).
// A view narrower than the base gives a zoom above 1, a wider one below 1,
// and the base lens itself exactly 1.
export function zoomOfLens(baseFovY: number, viewFovY: number): number {
  return Math.tan(baseFovY / 2) / Math.tan(viewFovY / 2)
}

// The effective vertical fov in radians a zoom presents through a base
// lens, inverting zoomOfLens: the same zoom reads back as the same lens.
export function lensOfZoom(baseFovY: number, zoom: number): number {
  return 2 * Math.atan(Math.tan(baseFovY / 2) / zoom)
}

// The authored clip planes of one view.
export type ViewClipPlanes = {
  readonly near: number
  readonly far: number
}

// The one clip range a plan presents: the smallest authored near plane and
// the largest authored far plane of its views, so the camera holds every
// view's depth range through an eased move between them.
export type ClipRange = {
  readonly near: number
  readonly far: number
}

// The clip range of a plan's views: the minimum near and the maximum far.
export function clipRangeOf(views: readonly ViewClipPlanes[]): ClipRange {
  const [first, ...rest] = views
  if (first === undefined) {
    throw new Error('a clip range needs at least one view')
  }
  let near = first.near
  let far = first.far
  for (const view of rest) {
    near = Math.min(near, view.near)
    far = Math.max(far, view.far)
  }
  return { near, far }
}
