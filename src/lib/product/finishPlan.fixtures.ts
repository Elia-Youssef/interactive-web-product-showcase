import { readFinishPlan, type FinishPlan, type FinishProblem } from './variants'

// The plan of a JSON the test expects to read; a broken read fails the test
// with the problems it reported.
export function plannedFinish(json: unknown): FinishPlan {
  const read = readFinishPlan(json)
  if (read.kind === 'broken') {
    throw new Error(`the finish plan must read, it broke with: ${JSON.stringify(read.problems)}`)
  }
  return read.plan
}

// The problems of a JSON the test expects to break; a plan that reads
// fails the test.
export function brokenFinishProblems(json: unknown): readonly FinishProblem[] {
  const read = readFinishPlan(json)
  if (read.kind === 'read') {
    throw new Error('the broken finish mapping must be reported as a broken read')
  }
  return read.problems
}
