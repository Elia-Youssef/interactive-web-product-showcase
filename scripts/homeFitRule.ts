// The home-fit rule (contract C5) over the rule table's input: the stored
// home camera holds both poses of the product with the contract margin.
// The report is plain data the rule turns into messages, so a suite reads
// the same verdicts the rule prints, never a recomputation beside it.
import { authoredCameraAspect, homeFitMargin } from '../src/lib/camera/config.ts'
import { homeFitVerdictsOf, round5, type HomeFitVerdict, type PoseOutcome } from './homeFit.ts'
import { translationKeyComponentBound } from './storageBounds.ts'
import type { ContractRuleInput } from './contractRules.ts'
import type { MeasuredHomeFitFacts } from './homeFitFacts.ts'

// One pose's verdict with the mesh node its binding point came from, or the
// pose the home camera cannot frame with the reason, in words.
export type PoseVerdict = { readonly kind: 'verdict' } & HomeFitVerdict & {
    readonly bindingNode: string
  }
export type PoseReport =
  PoseVerdict | { readonly kind: 'unframed'; readonly pose: string; readonly reason: string }

// What the home fit answers for one product: no home camera to measure
// through, facts the file cannot give, or the poses' reports plus the
// channels that leave the exploded pose unbounded.
export type HomeFitReport =
  | { readonly kind: 'noHomeCamera' }
  | { readonly kind: 'unreadable'; readonly reason: string }
  | {
      readonly kind: 'measured'
      readonly poses: readonly PoseReport[]
      readonly unbounded: readonly { readonly path: string; readonly targetName: string }[]
    }

type HomeFitInput = Pick<ContractRuleInput, 'structure' | 'homeFit' | 'storageBounds'>

export function homeFitReportOf({
  structure,
  homeFit,
  storageBounds,
}: HomeFitInput): HomeFitReport {
  const home = structure.cameraFacts.find((fact) => fact.name === 'CAM_home')
  if (home === undefined || home.ray === null) {
    return { kind: 'noHomeCamera' }
  }
  if (homeFit.kind === 'problem') {
    return { kind: 'unreadable', reason: homeFit.reason }
  }
  const ray = home.ray
  const restError = Math.sqrt(3) * storageBounds.positionNormalizedError * homeFit.sigmaMax
  // The exploded allowance adds the stored keys' own bound, derived for
  // translation keys only: a clip with another channel path (the channels
  // rule's violation) leaves the exploded pose unbounded, so it is named
  // instead of compared. The assembled pose reads no key.
  const unbounded = structure.animationChannels.filter((channel) => channel.path !== 'translation')
  const poses = [
    {
      label: 'assembled',
      points: homeFit.assembled.points,
      nodeNames: homeFit.assembled.nodeNames,
      worldError: restError,
    },
    ...(unbounded.length === 0
      ? [
          {
            label: 'exploded',
            points: homeFit.exploded.points,
            nodeNames: homeFit.exploded.nodeNames,
            worldError: restError + storageKeyErrorOf(structure, homeFit),
          },
        ]
      : []),
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
    unbounded: unbounded.map(({ path, targetName }) => ({ path, targetName })),
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
      return [
        ...report.poses.flatMap((pose) => {
          switch (pose.kind) {
            case 'verdict':
              return pose.holds ? [] : [poseViolationOf(pose)]
            case 'unframed':
              return [`the ${pose.pose} pose cannot be framed at home: ${pose.reason}`]
          }
        }),
        ...report.unbounded.map(
          (channel) =>
            `the exploded pose is not compared: the clip drives ${channel.path} on ` +
            `${channel.targetName}, whose stored keys have no derived storage bound`,
        ),
      ]
  }
}

// The message of one pose that misses the margin, in that pose's own values.
export function poseViolationOf(verdict: PoseVerdict): string {
  return (
    `the ${verdict.pose} pose keeps ${round5(verdict.free)} of the half frame free at home, ` +
    `below the ${homeFitMargin} margin by more than its storage allowance ` +
    `${round5(verdict.allowance)} (over the nearest corner ${round5(verdict.nearestDepth)}), ` +
    `bound by the ${verdict.bindingNode} mesh`
  )
}

// The widest world distance the stored translation keys can sit from their
// authored values: every key's own filter bound, grown by the world scale
// of the chain that carries it.
function storageKeyErrorOf(
  structure: HomeFitInput['structure'],
  homeFit: MeasuredHomeFitFacts,
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
