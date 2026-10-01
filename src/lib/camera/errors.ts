// The typed error of the stage camera rules: authored camera data that
// breaks a rule fails the product with every problem listed at once, the
// values named, the way the rig parse reports its contract problems.

import type { CameraLimitProblem } from './limits'

function formatProblemLine(problem: CameraLimitProblem): string {
  return `- ${problem.message}`
}

export class CameraLimitsError extends Error {
  // The product the broken camera data belongs to.
  readonly subject: string
  readonly problems: readonly CameraLimitProblem[]

  constructor(subject: string, problems: readonly CameraLimitProblem[]) {
    super(`Invalid stage camera for '${subject}':\n${problems.map(formatProblemLine).join('\n')}`)
    this.name = 'CameraLimitsError'
    this.subject = subject
    this.problems = problems
  }
}
