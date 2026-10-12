// The camera-group rules of the contract, as table entries: cameras are
// static roll-free root objects that no channel animates, the authored
// minimum's cause (a warning: an authored value the default limits never
// needed is a tolerance with no product cause), and the home fit: the
// stored home camera holds both poses of the product with the contract
// margin, exactly, on the stored bytes.

import type { Vec3 } from '../src/lib/camera/frame.ts'
import { homeFitReportOf, homeFitViolationsOf } from './homeFitRule.ts'
import { cameraAssemblyOf } from './validateCameras.ts'
import { cross, dot, rollFreeBasisOf, scale, sub } from './viewBasis.ts'
import type { ContractRule } from './contractRules.ts'
import { defineContractRule } from './contractRule.ts'

// The roll a stored camera can carry and still read as the roll-free view
// the controls rebuild: the exporter's quaternion re-derivation rounds to
// well under this, and a visible roll is orders above it.
const ROLL_TOLERANCE_DEG = 0.01

export const cameraRules: readonly ContractRule[] = [
  defineContractRule({
    key: 'camera-static-roll-free',
    group: 'cameras',
    needs: ['facts', 'structure'],
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
  }),
  defineContractRule({
    key: 'authored-minimum-needed',
    group: 'cameras',
    needs: ['manifest', 'structure', 'contract'],
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
  }),
  defineContractRule({
    key: 'home-holds-both-poses',
    group: 'cameras',
    needs: ['structure', 'homeFit'],
    check: (input) => ({ violations: homeFitViolationsOf(homeFitReportOf(input)), warnings: [] }),
  }),
]

// A value in the report at four decimals: enough to read a roll against
// the tolerance, without the float noise of the arctangent.
function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

// The signed angle, in degrees, from the roll-free up a view rebuilds to
// the camera's own up: zero for a camera the viewer presents unchanged.
function rollDegrees(cameraUp: Vec3, forward: Vec3): number {
  const basis = rollFreeBasisOf(forward)
  if (basis === null) {
    // A view straight along world up has no roll-free basis to compare
    // with; the polar limits own that camera.
    return 0
  }
  const own = sub(cameraUp, scale(forward, dot(cameraUp, forward)))
  const angle = Math.atan2(dot(cross(basis.up, own), forward), dot(basis.up, own))
  return (angle * 180) / Math.PI
}
