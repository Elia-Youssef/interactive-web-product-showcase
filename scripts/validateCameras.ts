// The camera contract check: the names rule (CAM_home required, hotspot
// cameras), the aspect rule, and the home view's limit rules through the
// one shared assembly the runtime plan runs. Its scope is the contract's
// own: the cameras the naming contract names (CAM_), the set the runtime
// rig walks.
import type { Product } from '../src/lib/product/index.ts'
import { CAMERA_HOME_NAME, CAMERA_PREFIX } from '../src/lib/product/contractNames.ts'
import {
  AUTHORED_CAMERA_RESOLUTION,
  authoredCameraAspect,
  cameraLimitConfig,
} from '../src/lib/camera/config.ts'
import { frameSpanOfMeshBoxes } from '../src/lib/camera/frame.ts'
import type { ProductStructure } from './structure.ts'
import type { CameraContract } from './manifestIo.ts'
import { checkResult, type CheckResult } from './validateChecks.ts'

// The camera contract: CAM_home is required (the start and reset view), a
// CAM_<id> whose id is no manifest hotspot is a warning (the camera does
// not break anything on its own), every CAM_ camera carries the one
// authored aspect ratio the project exports at, and the home view satisfies
// the same limit rules the runtime plan enforces, through the one shared
// rule assembly. The scope is the contract's own: the cameras the naming
// contract names (CAM_), the set the runtime rig checks, so a camera the
// site can never present is nobody's violation.
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
  violations.push(...homeLimitViolations(manifest, structure, contract))

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
  for (const fact of contractCameras(structure)) {
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

// The limit rules over the home view, through the one shared rule
// assembly: the home distance within the limits, the minimum outside the
// model, the home polar angle within the polar limits.
function homeLimitViolations(
  manifest: Product,
  structure: ProductStructure,
  contract: CameraContract,
): string[] {
  const contractFacts = contractCameras(structure)
  const home = contractFacts.find((fact) => fact.name === CAMERA_HOME_NAME)
  if (home === undefined || home.ray === null) {
    return []
  }
  if (structure.meshBoxes.length === 0) {
    return ['the model holds no meshes to frame, the home view has nothing to orbit']
  }
  const views = contractFacts.flatMap((fact) => (fact.ray === null ? [] : [fact.ray]))
  const check = contract.cameraContractProblems({
    views,
    home: home.ray,
    frame: frameSpanOfMeshBoxes(structure.meshBoxes),
    authoredDistanceLimits: manifest.camera ?? {},
    limits: cameraLimitConfig,
  })
  return check.problems.map((problem) => `camera ${CAMERA_HOME_NAME}: ${problem.message}`)
}

// The contract's cameras: the CAM_-named facts, the set the runtime rig
// walks, in document order.
function contractCameras(structure: ProductStructure) {
  return structure.cameraFacts.filter((fact) => fact.name.startsWith(CAMERA_PREFIX))
}
