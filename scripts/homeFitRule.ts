// The home-fit rule (contract C5) over the rule table's input: the stored
// home camera holds both poses of the product with the contract margin,
// exactly, on the stored bytes: the assembled pose at rest and the exploded
// pose at the clip's last stored key, the pose the viewer presents at the
// explode's end. The report is plain data the rule turns into messages, so
// a suite reads the same verdicts the rule prints, never a recomputation
// beside it.
import { authoredCameraAspect, homeFitMargin } from '../src/lib/camera/config.ts'
import {
  decimalsApart,
  homeFitVerdictsOf,
  type HomeFitVerdict,
  type PoseOutcome,
} from './homeFit.ts'
import type { ContractRuleInput } from './contractRules.ts'

// One pose's verdict with the mesh node its binding point came from, or the
// pose the home camera cannot frame with the reason, in words.
export type PoseVerdict = { readonly kind: 'verdict' } & HomeFitVerdict & {
    readonly bindingNode: string
  }
export type PoseReport =
  PoseVerdict | { readonly kind: 'unframed'; readonly pose: string; readonly reason: string }

// What the home fit answers for one product: no home camera to measure
// through, facts the file cannot give, or the poses' reports.
export type HomeFitReport =
  | { readonly kind: 'noHomeCamera' }
  | { readonly kind: 'unreadable'; readonly reason: string }
  | {
      readonly kind: 'measured'
      readonly poses: readonly PoseReport[]
    }

type HomeFitInput = Pick<ContractRuleInput, 'structure' | 'homeFit'>

export function homeFitReportOf({ structure, homeFit }: HomeFitInput): HomeFitReport {
  const home = structure.cameraFacts.find((fact) => fact.name === 'CAM_home')
  if (home === undefined || home.ray === null) {
    return { kind: 'noHomeCamera' }
  }
  if (homeFit.kind === 'problem') {
    return { kind: 'unreadable', reason: homeFit.reason }
  }
  const ray = home.ray
  const poses = [
    { label: 'assembled', ...homeFit.assembled },
    { label: 'exploded', ...homeFit.exploded },
  ]
  const outcomes = homeFitVerdictsOf(
    poses,
    ray.position,
    ray.forward,
    ray.fovY,
    authoredCameraAspect,
    homeFitMargin,
  )
  return {
    kind: 'measured',
    poses: outcomes.map((outcome, index) => poseReportOf(outcome, poses[index]?.nodeNames ?? [])),
  }
}

// One pose's outcome in the report's words: the verdict with the mesh its
// binding point came from, or the reason the pose cannot be framed.
function poseReportOf(outcome: PoseOutcome, nodeNames: readonly string[]): PoseReport {
  const nodeNameAt = (point: number) => nodeNames[point] ?? 'scene'
  switch (outcome.kind) {
    case 'verdict':
      return { ...outcome, bindingNode: nodeNameAt(outcome.bindingPoint) }
    case 'unprojectable':
      return {
        kind: 'unframed',
        pose: outcome.pose,
        reason:
          outcome.extent.kind === 'behindCamera'
            ? `a point of the ${nodeNameAt(outcome.extent.point)} mesh lies behind the home camera plane`
            : 'the home camera looks straight along world up, which has no roll-free view',
      }
  }
}

export function homeFitViolationsOf(report: HomeFitReport): string[] {
  switch (report.kind) {
    case 'noHomeCamera':
      return ['the home fit needs a perspective CAM_home with a stored ray']
    case 'unreadable':
      return [`the home fit cannot read the model: ${report.reason}`]
    case 'measured':
      return report.poses.flatMap((pose) => {
        switch (pose.kind) {
          case 'verdict':
            return pose.holds ? [] : [poseViolationOf(pose)]
          case 'unframed':
            return [`the ${pose.pose} pose cannot be framed at home: ${pose.reason}`]
        }
      })
  }
}

// The message of one pose that misses the margin, in that pose's own
// values: its free share at the decimals that tell it from the margin, and
// how far short it falls.
export function poseViolationOf(verdict: PoseVerdict): string {
  const decimals = decimalsApart(verdict.free, homeFitMargin)
  return (
    `the ${verdict.pose} pose keeps ${verdict.free.toFixed(decimals)} of the half frame free ` +
    `at home, ${(homeFitMargin - verdict.free).toExponential(2)} short of the ` +
    `${homeFitMargin} margin, bound by the ${verdict.bindingNode} mesh`
  )
}
