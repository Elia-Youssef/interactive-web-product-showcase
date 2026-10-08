// The camera-group rules of the contract, as table entries: cameras are
// static roll-free root objects that no channel animates, the authored
// minimum's cause (a warning: an authored value the default limits never
// needed is a tolerance with no product cause), and the home fit: the
// stored home camera holds both poses of the product with the contract
// margin, beyond what the file's own storage can move.

import type { Vec3 } from '../src/lib/camera/frame.ts'
import { authoredCameraAspect, homeFitMargin } from '../src/lib/camera/config.ts'
import { homeFitVerdictsOf, round5 } from './homeFit.ts'
import { translationKeyComponentBound } from './storageBounds.ts'
import { cameraAssemblyOf } from './validateCameras.ts'
import type { ContractRule } from './contractRules.ts'

// The roll a stored camera can carry and still read as the roll-free view
// the controls rebuild: the exporter's quaternion re-derivation rounds to
// well under this, and a visible roll is orders above it.
const ROLL_TOLERANCE_DEG = 0.01

export const cameraRules: readonly ContractRule[] = [
  {
    key: 'camera-static-roll-free',
    group: 'cameras',
    check: ({ facts, structure }) => {
      const violations: string[] = []
      const animated = new Set(structure.animationChannels.map((channel) => channel.targetName))
      for (const node of facts.nodes) {
        if (!node.name.startsWith('CAM_')) {
          continue
        }
        if (!node.rooted) {
          violations.push(`the camera ${node.name} is not a root object, cameras parent nowhere`)
        }
        if (animated.has(node.name)) {
          violations.push(`the camera ${node.name} is animated, cameras are read at the rest pose`)
        }
      }
      for (const camera of facts.cameras) {
        const ray = structure.cameraFacts.find((fact) => fact.name === camera.name)?.ray
        if (ray === null || ray === undefined || camera.up === null) {
          continue
        }
        const roll = rollDegrees(camera.up, ray.forward)
        if (Math.abs(roll) > ROLL_TOLERANCE_DEG) {
          violations.push(
            `the camera ${camera.name} rolls ${round4(roll)} degrees from the roll-free up, ` +
              'the controls rebuild every view with world up',
          )
        }
      }
      return { violations, warnings: [] }
    },
  },
  {
    key: 'authored-minimum-needed',
    group: 'cameras',
    check: ({ manifest, structure, contract }) => {
      const authored = manifest.camera?.minDistance
      if (authored === undefined) {
        return { violations: [], warnings: [] }
      }
      const assembled = cameraAssemblyOf(manifest, structure, contract)
      if (assembled.kind !== 'assembled') {
        return { violations: [], warnings: [] }
      }
      const withoutAuthored = contract.cameraContractProblems({
        ...assembled.input,
        authoredDistanceLimits: {
          ...assembled.input.authoredDistanceLimits,
          minDistance: undefined,
        },
      })
      if (withoutAuthored.kind === 'holds') {
        return {
          violations: [],
          warnings: [
            `camera.minDistance ${authored} is authored but the default minimum ` +
              `${withoutAuthored.distanceRange.min} passes every rule that reads the minimum: ` +
              'an authored value with no product cause is a tolerance',
          ],
        }
      }
      return { violations: [], warnings: [] }
    },
  },
  {
    key: 'home-holds-both-poses',
    group: 'cameras',
    check: ({ structure, homeFit, storageBounds }) => {
      const problem = homeFitProblemOf(structure)
      if (problem !== null) {
        return { violations: [problem], warnings: [] }
      }
      const home = structure.cameraFacts.find((fact) => fact.name === 'CAM_home')
      if (home === undefined || home.ray === null) {
        throw new Error('the home fit named no problem but found no camera ray')
      }
      const ray = home.ray
      const restError = Math.sqrt(3) * storageBounds.positionNormalizedError * homeFit.sigmaMax
      const verdicts = homeFitVerdictsOf(
        [
          {
            label: 'assembled',
            points: homeFit.assembled.points,
            worldError: restError,
          },
          {
            label: 'exploded',
            points: homeFit.exploded.points,
            worldError: restError + storageKeyErrorOf(structure, homeFit),
          },
        ],
        ray.position,
        ray.forward,
        ray.fovY,
        authoredCameraAspect,
        homeFitMargin,
      )
      const namesOf = (label: string) =>
        label === 'assembled' ? homeFit.assembled.nodeNames : homeFit.exploded.nodeNames
      return {
        violations: verdicts
          .filter((verdict) => !verdict.holds)
          .map(
            (verdict) =>
              `the ${verdict.pose} pose keeps ${round5(verdict.free)} of the half frame free at home, ` +
              `below the ${homeFitMargin} margin by more than the storage allowance ` +
              `${round5(verdict.allowance)} (bound ${round5(restError)} over the nearest corner ` +
              `${round5(verdict.nearestDepth)}), bound by the ` +
              `${namesOf(verdict.pose)[verdict.bindingPoint] ?? 'scene'} mesh`,
          ),
        warnings: [],
      }
    },
  },
]

// The one problem that stops the home fit before it measures, or null
// when both poses can be measured and compared: a home camera with no
// readable ray, or a rotation channel whose storage bound is not derived.
function homeFitProblemOf(structure: {
  cameraFacts: readonly {
    name: string
    ray: { position: Vec3; forward: Vec3; fovY: number } | null
  }[]
  animationChannels: readonly { path: string; targetName: string }[]
}): string | null {
  const home = structure.cameraFacts.find((fact) => fact.name === 'CAM_home')
  if (home === undefined || home.ray === null) {
    return 'the home fit needs a perspective CAM_home with a stored ray'
  }
  const rotationChannels = structure.animationChannels.filter(
    (channel) => channel.path === 'rotation',
  )
  if (rotationChannels.length > 0) {
    return (
      `rotation channel bound not implemented: the clip drives rotation on ` +
      `${rotationChannels.map((channel) => channel.targetName).join(', ')}, ` +
      'and the storage bound of a rotation output is not derived; ' +
      'the home fit covers translation keys only'
    )
  }
  return null
}

// The widest world distance the stored translation keys can sit from their
// authored values: every key's own filter bound, grown by the world scale
// of the chain that carries it.
function storageKeyErrorOf(
  structure: {
    animationChannels: readonly {
      path: string
      targetName: string
      components: number
      keyValues: readonly number[]
    }[]
  },
  homeFit: { parentSigmaByName: ReadonlyMap<string, number> },
): number {
  let keyError = 0
  for (const channel of structure.animationChannels) {
    if (channel.path !== 'translation') {
      continue
    }
    const parentSigma = homeFit.parentSigmaByName.get(channel.targetName)
    if (parentSigma === undefined) {
      continue
    }
    for (let key = 0; (key + 1) * channel.components <= channel.keyValues.length; key += 1) {
      const components = channel.keyValues.slice(
        key * channel.components,
        (key + 1) * channel.components,
      )
      keyError = Math.max(
        keyError,
        Math.sqrt(3) * translationKeyComponentBound(components) * parentSigma,
      )
    }
  }
  return keyError
}

// A value in the report at four decimals: enough to read a roll against
// the tolerance, without the float noise of the arctangent.
function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

// The signed angle, in degrees, from the roll-free up a view rebuilds to
// the camera's own up: zero for a camera the viewer presents unchanged.
function rollDegrees(cameraUp: Vec3, forward: Vec3): number {
  const right = cross(forward, [0, 1, 0])
  const rightLength = lengthOf(right)
  if (rightLength < 1e-9) {
    // A view straight along world up has no roll-free basis to compare
    // with; the polar limits own that camera.
    return 0
  }
  const unitRight = scale(right, 1 / rightLength)
  const rollFree = cross(unitRight, forward)
  const own = sub(cameraUp, scale(forward, dot(cameraUp, forward)))
  const angle = Math.atan2(dot(cross(rollFree, own), forward), dot(rollFree, own))
  return (angle * 180) / Math.PI
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function lengthOf(a: Vec3): number {
  return Math.sqrt(dot(a, a))
}
