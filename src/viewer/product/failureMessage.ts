import type { FinishProblem, ProductFailure, RigProblem } from '@lib/product'
import type { CameraLimitProblem } from '@lib/camera/limits'

// The display of a product failure in the stage's alert: a reason line for
// every failure and, when a contract breach lists problems, each problem as
// its own entry. The display carries no bullet characters of its own: the
// alert renders the entries as a semantic list, so the lines keep their
// list role whatever the alert's styling does.
export type ProductFailureDisplay = {
  readonly reason: string
  readonly problems: readonly string[] | undefined
}

export const productFailureCopy = {
  modelContract: 'The model breaks the product contract:',
  finishContract: 'The model breaks the finish mapping contract:',
  cameraContract: 'The authored cameras break the stage camera rules:',
} as const

// The display of a product failure, derived from its typed facts in the
// display layer: the stage's alert shows it, while the store and the
// automation keep the facts themselves. A contract breach lists every
// problem, so one look names everything to fix.
export function productFailureDisplay(failure: ProductFailure): ProductFailureDisplay {
  switch (failure.kind) {
    case 'load':
      return display(`Could not load ${failure.url}: ${failure.message}`)
    case 'model-contract':
      return problemDisplay(productFailureCopy.modelContract, failure.problems.map(rigLine))
    case 'finish-contract':
      return problemDisplay(productFailureCopy.finishContract, failure.problems.map(finishLine))
    case 'camera-contract':
      return problemDisplay(productFailureCopy.cameraContract, failure.problems.map(cameraLine))
    case 'presentation':
      return display(`The stage could not present the product: ${failure.message}`)
    case 'render':
      return display(`A presented frame failed: ${failure.message}`)
    case 'unexpected':
      return display(`Unexpected product error: ${failure.message}`)
  }
}

function display(reason: string): ProductFailureDisplay {
  return { reason, problems: undefined }
}

function problemDisplay(reason: string, problems: readonly string[]): ProductFailureDisplay {
  return { reason, problems }
}

function rigLine(problem: RigProblem): string {
  return problem.node === null ? problem.message : `${problem.node}: ${problem.message}`
}

function finishLine(problem: FinishProblem): string {
  if (problem.mesh === null) {
    return problem.message
  }
  const primitive = problem.primitive === null ? '' : ` primitive ${problem.primitive}`
  return `mesh ${problem.mesh}${primitive}: ${problem.message}`
}

function cameraLine(problem: CameraLimitProblem): string {
  return problem.message
}
