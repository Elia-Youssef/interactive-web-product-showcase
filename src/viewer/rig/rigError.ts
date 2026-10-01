// The typed error of the rig parse, modeled on CollectionError: a model
// that breaks the Blender contract fails the parse with every problem
// listed at once, never only the first, so one export round is fixed in one
// pass.

export type RigProblem = {
  // The contract node involved, when the problem names one.
  readonly node: string | null
  readonly message: string
}

function formatProblemLine(problem: RigProblem): string {
  return problem.node === null ? `- ${problem.message}` : `- ${problem.node}: ${problem.message}`
}

export class ProductRigError extends Error {
  // The slug of the product whose model broke the contract.
  readonly slug: string
  readonly problems: readonly RigProblem[]

  constructor(slug: string, problems: readonly RigProblem[]) {
    super(`Invalid product rig for '${slug}':\n${problems.map(formatProblemLine).join('\n')}`)
    this.name = 'ProductRigError'
    this.slug = slug
    this.problems = problems
  }
}
