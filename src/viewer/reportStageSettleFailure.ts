import { asError } from '@lib/errors'
import { StageRetiredError } from './StageRetiredError'

// Disposal is the owner's normal end, so it applies no failure or outcome.
// Retirement and other rejected work still reach the caller's failure
// channel, which defaults to the console for a settle with no outcome.
export function reportStageSettleFailure(
  cause: unknown,
  report: (error: Error) => void = (error) => console.error(error),
): void {
  if (cause instanceof StageRetiredError && cause.reason === 'disposed') {
    return
  }
  report(asError(cause))
}
