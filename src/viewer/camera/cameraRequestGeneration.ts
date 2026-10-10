import type { SequencedCameraStep } from '@lib/camera/cameraStep'
import type { CameraOutcomeEvent, CameraRequest } from '@store/index'

// The generation ownership of the camera request channel. Every
// outstanding request belongs to the watcher generation that started it,
// and only a live generation writes an outcome or reports a failure, so a
// watcher whose canvas was replaced can never answer for the canvas that
// followed it, whatever sequence it still holds. A generation ends exactly
// once, at its watcher's teardown, and the ending settles the newest
// sequence the generation still owes with one terminal retired outcome,
// over the moves it started and never saw settle and the steps still
// pending in the coalescer: the store keeps one record, so the newest owed
// sequence is the only one any reader compares against, and the reducer's
// guard keeps the report from replacing a newer record that already
// stands.
export class CameraRequestGeneration {
  private live = true
  private readonly outstanding = new Map<number, CameraRequest>()

  constructor(
    private readonly write: (event: CameraOutcomeEvent) => void,
    private readonly reportRejection: (message: string, cause: unknown) => void,
  ) {}

  isLive(): boolean {
    return this.live
  }

  // A move that started: its sequence owes an outcome until one lands.
  started(sequence: number, request: CameraRequest): void {
    this.outstanding.set(sequence, request)
  }

  // The outcome that settles a sequence's debt, written only while the
  // generation is live: a settle after the ending owes nothing and writes
  // nothing.
  settled(sequence: number, event: CameraOutcomeEvent): void {
    this.outstanding.delete(sequence)
    if (this.live) {
      this.write(event)
    }
  }

  // A move failure reported loudly, and only while the generation is
  // live: a retired watcher's late failure is nobody's page error.
  failure(message: string, cause: unknown): void {
    if (this.live) {
      this.reportRejection(message, cause)
    }
  }

  // The generation's one ending. It takes over the steps the coalescer
  // still holds, settles the newest sequence owed with one retired
  // outcome, then closes the generation to every later write.
  end(pending: readonly SequencedCameraStep[]): void {
    for (const { sequence, step } of pending) {
      this.outstanding.set(sequence, step)
    }
    let newest: { sequence: number; request: CameraRequest } | null = null
    for (const [sequence, request] of this.outstanding) {
      if (newest === null || sequence > newest.sequence) {
        newest = { sequence, request }
      }
    }
    if (newest !== null) {
      this.write({ kind: 'retired', sequence: newest.sequence, request: newest.request })
    }
    this.live = false
  }
}
