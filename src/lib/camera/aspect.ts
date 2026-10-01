// The aspect rule of the stage camera: "contain the authored frame". Pure
// math, exact to the float.

// The distance scale that keeps the authored frame whole when the stage is
// narrower than the authored aspect: every distance of the view (home,
// minimum and maximum) scales by authoredAspect over stageAspect, so the
// horizontal view angle the authored frame needs is contained at every
// stage aspect. A wider stage adds no margin: the scale is 1. One function
// computes the scale, and every distance uses it, so the zoom percentage is
// the same at any aspect and a resize keeps it.
export function containedDistanceScale(authoredAspect: number, stageAspect: number): number {
  return stageAspect < authoredAspect ? authoredAspect / stageAspect : 1
}
