// The home-fit rule (contract C5) over the rule table's input: the stored
// home camera holds both poses of the product with the contract margin.
// The report is plain data the rule turns into messages, so a suite reads
// the same verdicts the rule prints, never a recomputation beside it.
import { authoredCameraAspect, homeFitMargin } from '../src/lib/camera/config.ts'
import { homeFitVerdictsOf, round5, type HomeFitVerdict } from './homeFit.ts'
import { translationKeyComponentBound } from './storageBounds.ts'
import type { ContractRuleInput } from './contractRules.ts'

// One pose's verdict with the mesh node its binding point came from.
export type PoseVerdict = HomeFitVerdict & { readonly bindingNode: string }

// What the home fit answers for one product: no home camera to measure
// through, or the measured verdicts plus the channels that leave the
// exploded pose unbounded.
export type HomeFitReport =
  | { readonly kind: 'noHomeCamera' }
  | {
      readonly kind: 'measured'
      readonly verdicts: readonly PoseVerdict[]
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
  const verdicts = homeFitVerdictsOf(
    poses,
    ray.position,
    ray.forward,
    ray.fovY,
    authoredCameraAspect,
    homeFitMargin,
  )
  return {
    kind: 'measured',
    verdicts: verdicts.map((verdict, index) => ({
      ...verdict,
      bindingNode: poses[index]?.nodeNames[verdict.bindingPoint] ?? 'scene',
    })),
    unbounded: unbounded.map(({ path, targetName }) => ({ path, targetName })),
  }
}

export function homeFitViolationsOf(report: HomeFitReport): string[] {
  switch (report.kind) {
    case 'noHomeCamera':
      return ['the home fit needs a perspective CAM_home with a stored ray']
    case 'measured':
      return [
        ...report.verdicts.filter((verdict) => !verdict.holds).map(poseViolationOf),
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
  homeFit: HomeFitInput['homeFit'],
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
