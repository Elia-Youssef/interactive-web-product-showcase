import type { FinishProblem, ProductFailure, RigProblem } from '@lib/product'
import type { CameraLimitProblem } from '@lib/camera/limits'

// The display message of a product failure, derived from its typed facts in
// the display layer: the stage's alert shows it, while the store and the
// automation keep the facts themselves. A contract breach lists every
// problem on a line of its own, so one look names everything to fix.
export function productFailureMessage(failure: ProductFailure): string {
  switch (failure.kind) {
    case 'load':
      return `Could not load ${failure.url}: ${failure.message}`
    case 'model-contract':
      return problemList('The model breaks the product contract:', failure.problems.map(rigLine))
    case 'finish-contract':
      return problemList(
        'The model breaks the finish mapping contract:',
        failure.problems.map(finishLine),
      )
    case 'camera-contract':
      return problemList(
        'The authored cameras break the stage camera rules:',
        failure.problems.map(cameraLine),
      )
    case 'presentation':
      return `The stage could not present the product: ${failure.message}`
    case 'render':
      return `A presented frame failed: ${failure.message}`
    case 'unexpected':
      return `Unexpected product error: ${failure.message}`
  }
}

function problemList(heading: string, lines: readonly string[]): string {
  return [heading, ...lines].join('\n')
}

function rigLine(problem: RigProblem): string {
  return problem.node === null ? `- ${problem.message}` : `- ${problem.node}: ${problem.message}`
}

function finishLine(problem: FinishProblem): string {
  if (problem.mesh === null) {
    return `- ${problem.message}`
  }
  const primitive = problem.primitive === null ? '' : ` primitive ${problem.primitive}`
  return `- mesh ${problem.mesh}${primitive}: ${problem.message}`
}

function cameraLine(problem: CameraLimitProblem): string {
  return `- ${problem.message}`
}
