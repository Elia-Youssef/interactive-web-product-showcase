// The one-line reason a stage renderer that cannot start reports. Every
// start-up failure path routes its error through this builder, so the store,
// the alert and the e2e expectations read the same sentence.
export function initFailureReason(error: Error): string {
  return `The stage renderer failed to start: ${error.message}`
}
