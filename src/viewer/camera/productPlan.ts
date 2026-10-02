import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { CAMERA_HOME_ID, type Product } from '@lib/product'
import { CameraLimitsError } from '@lib/camera/errors'
import {
  distanceLimitProblems,
  polarLimitProblems,
  resolvedDistanceLimits,
} from '@lib/camera/limits'
import type { CameraLimitProblem, ViewOrbit } from '@lib/camera/limits'
import type { DistanceRange, PolarRange } from '@lib/camera/limits'
import { orbitAnglesOf, orbitViewOfAuthoredCamera } from '@lib/camera/view'
import type { Vec3 } from '@lib/camera/view'
import { clipRangeOf } from '@lib/camera/lens'
import type { ClipRange } from '@lib/camera/lens'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
import { stageCameraConfig } from './config'

// One presented view of the product: the orbit position and target in stage
// space at the authored aspect, the vertical fov in radians the view keeps,
// and the authored near and far planes.
export type CameraView = {
  readonly position: Vec3
  readonly target: Vec3
  readonly fovY: number
  readonly near: number
  readonly far: number
}

// The camera plan of one product: its views by id, the distance limits and
// the polar limits the controls enforce, all at the authored aspect, the
// authored aspect itself for the stage's distance scale, the home lens the
// views present through, and the one clip range every view shares.
// Everything the controls need to own the stage camera comes from here,
// computed once per load from the rig and the measured frame.
export type CameraPlan = {
  readonly views: ReadonlyMap<string, CameraView>
  readonly distanceRange: DistanceRange
  readonly polarRange: PolarRange
  readonly authoredAspect: number
  // The base lens of the plan, the home view's fov: every view rides the
  // controls' zoom channel as the zoom that turns this lens into the
  // view's.
  readonly baseFovY: number
  // The smallest authored near and the largest authored far of the views,
  // set on the stage camera once per plan, so an eased move between views
  // never clips mid-way.
  readonly clipRange: ClipRange
}

// The product presentation centers the model on the origin, so the model
// center the views orbit is the stage-space origin.
const MODEL_CENTER_IN_STAGE: Vec3 = [0, 0, 0]

// Builds the camera plan of a loaded product, or fails with a
// CameraLimitsError naming every rule the authored camera data breaks. The
// same rules as the build-time validate step, at runtime, against the
// loaded data. Call it after the centering group's position is committed:
// the view positions are read from the cameras' world transforms.
export function buildCameraPlan(rig: ProductRig, manifest: Product, frame: ModelFrame): CameraPlan {
  const problems: CameraLimitProblem[] = []
  const { views, home, authoredAspect } = collectViews(rig, problems)
  if (home === null) {
    // The rig parse fails a product without CAM_home, so reaching this
    // point without a home view is a caller contract break, not authored
    // data breaking a rule.
    throw new Error('internal error: the rig holds no home camera but the parse reported none')
  }

  const homeAngles = orbitAnglesOf(home.position, home.target)
  const distanceRange = resolvedDistanceLimits(manifest.camera ?? {}, homeAngles.distance, {
    minRatio: stageCameraConfig.minHomeDistanceRatio,
    maxRatio: stageCameraConfig.maxHomeDistanceRatio,
  })
  const polarRange: PolarRange = {
    min: MathUtils.degToRad(stageCameraConfig.minPolarAngleDegrees),
    max: MathUtils.degToRad(stageCameraConfig.maxPolarAngleDegrees),
  }
  // Every view obeys the limit rules, the home view included: a close-up
  // the limits would clamp away is as broken as a home that fails them.
  const viewOrbits: ViewOrbit[] = [...views].map(([id, view]) => {
    const angles = orbitAnglesOf(view.position, view.target)
    return { id, distance: angles.distance, polar: angles.polar }
  })
  problems.push(
    ...distanceLimitProblems(distanceRange, viewOrbits, frame.radius),
    ...polarLimitProblems(polarRange, viewOrbits),
  )

  if (problems.length > 0) {
    throw new CameraLimitsError(manifest.slug, problems)
  }
  return {
    views,
    distanceRange,
    polarRange,
    authoredAspect,
    baseFovY: home.fovY,
    clipRange: clipRangeOf([...views.values()]),
  }
}

type CollectedViews = {
  readonly views: Map<string, CameraView>
  readonly home: CameraView | null
  readonly authoredAspect: number
}

// One orbit view per rig camera, read from the camera's world transform.
// A camera that is not perspective is a problem of its own; the home view
// and its authored aspect are carried out for the limit rules.
function collectViews(rig: ProductRig, problems: CameraLimitProblem[]): CollectedViews {
  const views = new Map<string, CameraView>()
  let home: CameraView | null = null
  let authoredAspect = 1

  for (const [id, camera] of rig.cameras) {
    if (!(camera instanceof PerspectiveCamera)) {
      problems.push({
        rule: 'perspective-views',
        message: `the camera CAM_${id} does not carry a perspective camera`,
      })
      continue
    }
    // The camera hangs inside the centered scene; the world reads below
    // recompose the whole ancestor chain, so the group's committed
    // centering offset is included though nothing has rendered yet.
    const position = camera.getWorldPosition(new Vector3())
    const forward = camera.getWorldDirection(new Vector3())
    const view: CameraView = {
      ...orbitViewOfAuthoredCamera(
        {
          position: [position.x, position.y, position.z],
          forward: [forward.x, forward.y, forward.z],
          fovY: MathUtils.degToRad(camera.fov),
        },
        MODEL_CENTER_IN_STAGE,
      ),
      near: camera.near,
      far: camera.far,
    }
    views.set(id, view)
    if (id === CAMERA_HOME_ID) {
      home = view
      authoredAspect = camera.aspect
    }
  }
  return { views, home, authoredAspect }
}
