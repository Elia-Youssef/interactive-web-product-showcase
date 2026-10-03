// The camera contract check: the names rule (CAM_home required, hotspot
// cameras), the aspect rule, and the limit rules over every view through
// the one shared assembly the runtime plan runs, over the views the
// runtime rig resolves.
import type { Product } from '../src/lib/product/index.ts'
import {
  CAMERA_HOME_ID,
  CAMERA_HOME_NAME,
  CAMERA_PREFIX,
} from '../src/lib/product/contractNames.ts'
import {
  AUTHORED_CAMERA_RESOLUTION,
  authoredCameraAspect,
  cameraLimitConfig,
} from '../src/lib/camera/config.ts'
import { frameSpanOfMeshBoxes } from '../src/lib/camera/frame.ts'
import type { NamedCameraRay } from '../src/lib/camera/view.ts'
import type { CameraFact } from './modelFacts.ts'
import type { ProductStructure } from './structure.ts'
import type { CameraContract } from './manifestIo.ts'
import { checkResult, type CheckResult } from './validateChecks.ts'

// The camera contract: CAM_home is required (the start and reset view), a
// CAM_<id> whose id is no manifest hotspot is a warning (the camera does
// not break anything on its own), every CAM_ camera carries the one
// authored aspect ratio the project exports at, and every view satisfies
// the same limit rules the runtime plan enforces, through the one shared
// rule assembly.
export function checkCameras(
  manifest: Product,
  structure: ProductStructure,
  contract: CameraContract,
): CheckResult {
  const violations: string[] = []
  const warnings: string[] = []
  if (!structure.cameraNames.includes(CAMERA_HOME_NAME)) {
    violations.push(`no ${CAMERA_HOME_NAME} node, the start and reset view is required`)
  }
  const hotspotIds = new Set(manifest.hotspots.map((hotspot) => hotspot.id))
  for (const cameraName of structure.cameraNames) {
    if (!cameraName.startsWith(CAMERA_PREFIX)) {
      continue
    }
    const id = cameraName.slice(CAMERA_PREFIX.length)
    if (cameraName !== CAMERA_HOME_NAME && !hotspotIds.has(id)) {
      warnings.push(`camera ${cameraName} has no manifest hotspot '${id}'`)
    }
  }
  violations.push(...cameraAspectViolations(structure))
  violations.push(...viewLimitViolations(manifest, structure, contract))

  const detail =
    structure.cameraNames.length === 0 ? 'no cameras' : `found ${structure.cameraNames.join(', ')}`
  return checkResult('cameras', detail, violations, warnings)
}

// The aspect rule over the contract's cameras: every CAM_ camera carries
// the authored aspect ratio, exactly, and a camera with none is a violation
// of its own. A camera that is not perspective carries neither an aspect
// nor a view the site can present, and is reported for what it is.
function cameraAspectViolations(structure: ProductStructure): string[] {
  const violations: string[] = []
  for (const fact of structure.cameraFacts) {
    if (!fact.name.startsWith(CAMERA_PREFIX)) {
      continue
    }
    if (fact.ray === null) {
      violations.push(
        `camera ${fact.name} is not a perspective camera, the site presents perspective views only`,
      )
      continue
    }
    if (fact.aspect === null) {
      violations.push(
        `camera ${fact.name} carries no aspect ratio, ` +
          `expected the authored ${AUTHORED_CAMERA_RESOLUTION.width} / ${AUTHORED_CAMERA_RESOLUTION.height}`,
      )
      continue
    }
    if (fact.aspect !== authoredCameraAspect) {
      violations.push(
        `camera ${fact.name} carries aspect ratio ${fact.aspect}, ` +
          `expected the authored ${AUTHORED_CAMERA_RESOLUTION.width} / ${AUTHORED_CAMERA_RESOLUTION.height}`,
      )
    }
  }
  return violations
}

// The limit rules over every view, through the one shared rule assembly:
// each view within the distance limits, the minimum outside the model,
// each view within the polar limits. The assembly's messages name the view
// they fail on, so they are reported as they come.
function viewLimitViolations(
  manifest: Product,
  structure: ProductStructure,
  contract: CameraContract,
): string[] {
  const views = contractViews(manifest, structure)
  if (!views.some((view) => view.id === CAMERA_HOME_ID)) {
    // The names rule above reports a missing CAM_home and the aspect rule a
    // home that is not perspective; without a home view the limits have no
    // distance to derive from.
    return []
  }
  if (structure.meshBoxes.length === 0) {
    return ['the model holds no meshes to frame, the views have nothing to orbit']
  }
  const check = contract.cameraContractProblems({
    views,
    homeId: CAMERA_HOME_ID,
    frame: frameSpanOfMeshBoxes(structure.meshBoxes),
    authoredDistanceLimits: manifest.camera ?? {},
    limits: cameraLimitConfig,
  })
  return check.problems.map((problem) => problem.message)
}

// The views the limit rules check: the set the runtime rig resolves and
// the plan presents. That is the home view, then one close-up per manifest
// hotspot whose CAM_<id> camera the model carries, in manifest order, each
// the first camera of its name. A CAM_ camera named after no hotspot is a
// view the site can never present, so it is nobody's violation; a camera
// that is not perspective has no view at all, and the aspect rule reports
// it.
export function contractViews(manifest: Product, structure: ProductStructure): NamedCameraRay[] {
  const views: NamedCameraRay[] = []
  for (const id of [CAMERA_HOME_ID, ...manifest.hotspots.map((hotspot) => hotspot.id)]) {
    const ray = firstCameraNamed(structure.cameraFacts, `${CAMERA_PREFIX}${id}`)?.ray ?? null
    if (ray !== null) {
      views.push({ id, ray })
    }
  }
  return views
}

function firstCameraNamed(facts: readonly CameraFact[], name: string): CameraFact | undefined {
  return facts.find((fact) => fact.name === name)
}
