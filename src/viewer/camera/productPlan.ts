import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { CAMERA_HOME_ID, type Product } from '@lib/product'
import { CameraLimitsError } from '@lib/camera/errors'
import type { CameraLimitProblem } from '@lib/camera/limits'
import { cameraContractProblems } from '@lib/camera/contract'
import { cameraLimitConfig } from '@lib/camera/config'
import type { DistanceRange, PolarRange } from '@lib/camera/limits'
import { orbitViewOfAuthoredCamera } from '@lib/camera/view'
import type { AuthoredCameraRay, NamedCameraRay, Vec3 } from '@lib/camera/view'
import { clipRangeOf } from '@lib/camera/lens'
import type { ClipRange } from '@lib/camera/lens'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'

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
// center the views orbit is the stage-space origin. The rays read below are
// stage-space too, so one space holds the whole check: the center the
// assembly projects onto and the rays it projects are the model's own.
const MODEL_CENTER_IN_STAGE: Vec3 = [0, 0, 0]

// Builds the camera plan of a loaded product, or fails with a
// CameraLimitsError naming every rule the authored camera data breaks. The
// rules are the one contract assembly the build-time validate step runs,
// here against the loaded data, and the limits the plan presents are the
// limits that assembly resolved, so what was checked is what is presented.
// A camera aspect validate could not check (a missing one, which validate
// rejects) never reaches this point, because the loader defaults it outside
// our code. Call it after the centering group's position is committed: the
// view positions are read from the cameras' world transforms.
export function buildCameraPlan(rig: ProductRig, manifest: Product, frame: ModelFrame): CameraPlan {
  const problems: CameraLimitProblem[] = []
  const { views, rays, home } = collectViews(rig, problems)
  if (home === null) {
    // The rig parse fails a product without CAM_home, so reaching this
    // point without a home view is a caller contract break, not authored
    // data breaking a rule.
    throw new Error('internal error: the rig holds no home camera but the parse reported none')
  }

  const check = cameraContractProblems({
    views: rays,
    homeId: CAMERA_HOME_ID,
    frame: { center: MODEL_CENTER_IN_STAGE, radius: frame.radius },
    authoredDistanceLimits: manifest.camera ?? {},
    limits: cameraLimitConfig,
  })
  problems.push(...check.problems)

  if (problems.length > 0) {
    throw new CameraLimitsError(manifest.slug, problems)
  }
  return {
    views,
    distanceRange: check.distanceRange,
    polarRange: check.polarRange,
    authoredAspect: home.aspect,
    baseFovY: home.view.fovY,
    clipRange: clipRangeOf([...views.values()]),
  }
}

// The home camera's facts, carried out of the rig walk together: the view
// the controls present and the authored aspect the stage's distance scale
// rides on.
type CollectedHome = {
  readonly view: CameraView
  readonly aspect: number
}

type CollectedViews = {
  readonly views: Map<string, CameraView>
  // Every perspective camera's authored ray by its view id, in rig order:
  // the view list the contract assembly checks, the home view among them.
  readonly rays: NamedCameraRay[]
  readonly home: CollectedHome | null
}

// One orbit view per rig camera, read from the camera's world transform,
// and its named ray for the contract assembly. A camera that is not
// perspective is a problem of its own; the home view and its authored
// aspect are carried out for the plan.
function collectViews(rig: ProductRig, problems: CameraLimitProblem[]): CollectedViews {
  const views = new Map<string, CameraView>()
  const rays: NamedCameraRay[] = []
  let home: CollectedHome | null = null

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
    const ray: AuthoredCameraRay = {
      position: [position.x, position.y, position.z],
      forward: [forward.x, forward.y, forward.z],
      fovY: MathUtils.degToRad(camera.fov),
    }
    const view: CameraView = {
      ...orbitViewOfAuthoredCamera(ray, MODEL_CENTER_IN_STAGE),
      near: camera.near,
      far: camera.far,
    }
    views.set(id, view)
    rays.push({ id, ray })
    if (id === CAMERA_HOME_ID) {
      home = { view, aspect: camera.aspect }
    }
  }
  return { views, rays, home }
}
