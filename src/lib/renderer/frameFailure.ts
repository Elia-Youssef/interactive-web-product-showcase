// The one-line reason a started stage renderer reports when a presented
// frame throws while no product owns the stage's frames: the stage itself
// failed to present.
export function frameFailureReason(error: Error): string {
  return `The stage renderer failed to present a frame: ${error.message}`
}
