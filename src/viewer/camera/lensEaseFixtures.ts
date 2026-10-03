import { CameraControlsImpl } from '@react-three/drei'
import {
  AnimationClip,
  Box3,
  MathUtils,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
import type { StageCameraState } from './stageCameraApi'
import { presentPlan } from './stageCameraApi'
import { stageCameraConfig } from './config'
import type { CameraPlan, CameraView } from './productPlan'
import { buildCameraPlan } from './productPlan'

// The staging of the eased lens ride tests: the plan with three differently
// lensed views, and the real controls installed and constructed the way
// drei's CameraControls component does it (its core/CameraControls.js)
// minus the DOM, presented through the stage camera's own API. The eased
// move mechanics the tests assert with live in lensEaseMoves.ts.

// The stand-in for the two inert DOMRects the controls' constructor fields
// for pointer hit areas, a browser global Node lacks and the headless
// controls never read without a DOM element. The test stubs it in; this
// module writes no globals.
export class DomRectStandIn {
  x: number
  y: number
  width: number
  height: number

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  get left(): number {
    return this.x
  }

  get top(): number {
    return this.y
  }

  get right(): number {
    return this.x + this.width
  }

  get bottom(): number {
    return this.y + this.height
  }
}

// The same subset of three drei hands to the controls on install, so the
// class here is the class the stage runs.
CameraControlsImpl.install({
  THREE: {
    Box3,
    MathUtils: { clamp: MathUtils.clamp },
    Matrix4,
    Quaternion,
    Raycaster,
    Sphere,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
  },
})

// The step of the hand-driven frame loop.
export const STEP = 1 / 60
// A runaway cap, not a wait: the loop is driven by the controls' own rest,
// and the cap only turns a move that never rests into a failure.
export const STEP_BUDGET = 600
// The stage aspect the fixtures build the plan at, so the aspect scale of
// every distance is 1 and the expectations carry no scale.
export const STAGE_ASPECT = 1.6

function rigWith(cameras: readonly PerspectiveCamera[]): ProductRig {
  return {
    parts: new Map(),
    hotspots: [],
    cameras: new Map(cameras.map((camera) => [camera.name.slice('CAM_'.length), camera])),
    shadow: new Object3D(),
    clip: new AnimationClip('Explode', 1, []),
    variants: [],
  }
}

// A centered frame, so the views orbit the origin.
const frame: ModelFrame = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  radius: 0.05,
  meshes: 1,
  triangles: 12,
}

// The plan under test: a home lens of 25 degrees and two close-ups in the
// low teens, the shape of a product whose hotspot views magnify. All three
// cameras sit on the +Z axis looking at the origin, so a move between them
// eases the distance and the zoom and nothing else. The clip planes differ
// per view, so the one plan clip range is visible in what the presentation
// sets.
function planOf(): CameraPlan {
  const home = new PerspectiveCamera(25, STAGE_ASPECT, 0.2, 50)
  home.name = 'CAM_home'
  home.position.set(0, 0, 1.2)
  const closeUp = new PerspectiveCamera(11, STAGE_ASPECT, 0.1, 30)
  closeUp.name = 'CAM_driver'
  closeUp.position.set(0, 0, 0.72)
  const midView = new PerspectiveCamera(14, STAGE_ASPECT, 0.3, 40)
  midView.name = 'CAM_shell'
  midView.position.set(0, 0, 0.96)
  const build = buildCameraPlan(
    rigWith([home, closeUp, midView]),
    parseProduct(sampleOneManifest, 'sample-one.test'),
    frame,
  )
  if (build.kind === 'broken') {
    throw new Error(`the staged plan must build, it broke with: ${JSON.stringify(build.problems)}`)
  }
  return build.plan
}

// The staged plan on real controls, presented at its home view through the
// presentation API, then one frame so the controls have written the zoom
// and the pose onto the camera. The rest counter listens for the controls'
// rest event, the signal every eased move ends on.
export function staged(): {
  plan: CameraPlan
  controls: CameraControlsImpl
  camera: PerspectiveCamera
  rests: RestCounter
} {
  const plan = planOf()
  const camera = new PerspectiveCamera(70, STAGE_ASPECT, 0.05, 100)
  const controls = new CameraControlsImpl(camera)
  controls.smoothTime = stageCameraConfig.transitionSmoothTimeSeconds
  const state: StageCameraState = {
    controls,
    camera,
    planRef: { current: null },
    appliedRangeRef: { current: null },
    stageAspect: () => STAGE_ASPECT,
    invalidate: () => {},
  }
  presentPlan(state, plan, 'home')
  controls.update(STEP)
  return { plan, controls, camera, rests: new RestCounter(controls) }
}

// Counts the controls' rest events.
export class RestCounter {
  count = 0

  constructor(controls: CameraControlsImpl) {
    controls.addEventListener('rest', () => {
      this.count += 1
    })
  }
}

// The view of the test plan by id, failing the test's own setup when the
// id is not there.
export function viewOf(plan: CameraPlan, id: string): CameraView {
  const view = plan.views.get(id)
  if (view === undefined) {
    throw new Error(`the test plan must hold the view '${id}'`)
  }
  return view
}
