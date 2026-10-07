import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { CAMERA_HOME_ID, type Product } from '@lib/product'
import type { CameraLimitProblem } from '@lib/camera/limits'
import { cameraContractProblems } from '@lib/camera/contract'
import { cameraLimitConfig } from '@lib/camera/config'
import type { DistanceRange, PolarRange } from '@lib/camera/limits'
import { orbitViewOfAuthoredCamera } from '@lib/camera/view'
import { viewPivotOf } from '@lib/camera/pivot'
import type { AuthoredCameraRay, NamedCameraRay, Vec3 } from '@lib/camera/view'
import { boundsInStageSpace, inStageSpace } from '@lib/camera/frame'
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

// The outcome of a plan build: the plan, or every rule the authored camera
// data breaks. Authored data that breaks a rule is an outcome the product
// path anticipates, so it is a value the caller routes, never a throw.
export type CameraPlanBuild =
  | { readonly kind: 'planned'; readonly plan: CameraPlan }
  | { readonly kind: 'broken'; readonly problems: readonly CameraLimitProblem[] }

// The product presentation centers the model on the origin (PresentedProduct
// mounts the scene under a group offset by the frame center), so the model
// center the home view orbits is the stage-space origin. The rays read
// below are stage-space too, and the anchor rests and the bounds, which the
// rig and the frame carry in the scene's own space, move into stage space
// by the same center, so one space holds the whole check.
const MODEL_CENTER_IN_STAGE: Vec3 = [0, 0, 0]

// Builds the camera plan of a loaded product, or reports every rule the
// authored camera data breaks, each with its values named. The
// rules are the one contract assembly the build-time validate step runs,
// here against the loaded data, and the limits the plan presents are the
// limits that assembly resolved, so what was checked is what is presented.
// A camera aspect validate could not check (a missing one, which validate
// rejects) never reaches this point, because the loader defaults it outside
// our code. Call it after the centering group's position is committed: the
// view positions are read from the cameras' world transforms.
export function buildCameraPlan(
  rig: ProductRig,
  manifest: Product,
  frame: ModelFrame,
): CameraPlanBuild {
  const problems: CameraLimitProblem[] = []
  const { views, rays, home } = collectViews(rig, frame, problems)
  if (home === null) {
    // The rig parse fails a product without CAM_home, so reaching this
    // point without a home view is a caller contract break, not authored
    // data breaking a rule.
    throw new Error('internal error: the rig holds no home camera but the parse reported none')
  }

  const check = cameraContractProblems({
    product: manifest.slug,
    views: rays,
    homeId: CAMERA_HOME_ID,
    bounds: boundsInStageSpace(frame, centerOf(frame)),
    explodedBounds:
      rig.explodedBounds === null ? null : boundsInStageSpace(rig.explodedBounds, centerOf(frame)),
    authoredDistanceLimits: manifest.camera ?? {},
    limits: cameraLimitConfig,
  })
  if (check.kind === 'broken' || problems.length > 0) {
    return {
      kind: 'broken',
      problems: [...problems, ...(check.kind === 'broken' ? check.problems : [])],
    }
  }
  return {
    kind: 'planned',
    plan: {
      views,
      distanceRange: check.distanceRange,
      polarRange: check.polarRange,
      authoredAspect: home.aspect,
      baseFovY: home.view.fovY,
      clipRange: clipRangeOf([...views.values()]),
    },
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
function collectViews(
  rig: ProductRig,
  frame: ModelFrame,
  problems: CameraLimitProblem[],
): CollectedViews {
  const views = new Map<string, CameraView>()
  const rays: NamedCameraRay[] = []
  let home: CollectedHome | null = null

  const anchorRests = new Map<string, Vec3>()
  for (const [id, rest] of rig.anchorRest) {
    anchorRests.set(id, inStageSpace(rest, centerOf(frame)))
  }

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
    const choice = viewPivotOf(id, MODEL_CENTER_IN_STAGE, anchorRests)
    if (choice.kind === 'broken') {
      problems.push(choice.problem)
      continue
    }
    const pivot = choice.pivot
    const view: CameraView = {
      ...orbitViewOfAuthoredCamera(ray, pivot.point),
      near: camera.near,
      far: camera.far,
    }
    views.set(id, view)
    rays.push({ id, ray, pivot })
    if (id === CAMERA_HOME_ID) {
      home = { view, aspect: camera.aspect }
    }
  }
  return { views, rays, home }
}

// The frame center the presentation's centering group moves the scene by.
function centerOf(frame: ModelFrame): Vec3 {
  return [frame.centerX, frame.centerY, frame.centerZ]
}
