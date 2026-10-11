// Public API of the explode math: the map from progress to clip time and
// the critically damped spring that produces the progress. Both are pure
// functions over numbers, unit-tested, and shared by the store slice and
// the scene feature.

export {
  EXPLODE_T_MAX,
  EXPLODE_T_MIN,
  ExplodeRangeError,
  checkExplodeT,
  explodeClipTime,
} from './clipTime'
export { isSpringAtRest, springSettings, stepSpring } from './spring'
export type { SpringSettings, SpringState, SpringStepTarget } from './spring'
