// The report of a stage renderer that cannot start: the typed rejection a
// failed start leaves when its rollback also fails, and the one sentence
// every reader of a start failure shares.

// A start failure stays the reported cause. A rollback that fails with a
// different error travels with it, never instead of it and never silently.
// A rollback that rejects with the start failure itself is not a second
// failure, so that case never builds this shape.
export class StageRendererStartError extends Error {
  // The failure that made the start fail; it stays the reported cause.
  readonly startup: Error
  // The different failure the rollback of the failed renderer raised.
  readonly rollback: Error

  constructor(startup: Error, rollback: Error) {
    // The message stays the start failure's own message, so a reader that
    // reads only the message reports the same cause as before.
    super(startup.message)
    if (rollback === startup) {
      throw new Error(
        'a failed renderer start must not carry its own error as the rollback failure',
      )
    }
    this.name = 'StageRendererStartError'
    this.startup = startup
    this.rollback = rollback
  }
}

// The one-line reason a stage renderer that cannot start reports. Every
// start-up failure path routes its error through this builder, so the store,
// the alert and the e2e expectations read the same sentence.
export function initFailureReason(error: Error): string {
  const start = `The stage renderer failed to start: ${error.message}`
  return error instanceof StageRendererStartError
    ? `${start}; the rollback of the failed renderer also failed: ${error.rollback.message}`
    : start
}
