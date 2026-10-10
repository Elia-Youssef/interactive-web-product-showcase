export type CameraFrameRead = {
  readonly azimuth: number
  readonly polar: number
  readonly distance: number
}

export type CameraRequestFrame = CameraFrameRead & {
  readonly sequence: number
  readonly frame: number
}

export type CameraCompletionRead = {
  readonly idle: boolean
  readonly moving: boolean
  readonly interacting: boolean
  readonly requestedSequence: number
  readonly presentedSequence: number
  readonly outcomeSequence: number
  readonly pendingScene: number
  readonly frame: number
  readonly firstRequestFrame: CameraRequestFrame | null
}

// Controls report their actual update and gesture lifetime. A completed
// request also owes a presented frame and its outcome; rest thresholds or
// an arbitrary quiet interval cannot replace any of those obligations.
export class CameraRequestCompletion {
  private moving = false
  private interacting = false
  private presentedAfterUpdate = false
  private sequence = -1
  private frame = 0
  private first: CameraRequestFrame | null = null

  begin(): void {
    this.moving = true
    this.presentedAfterUpdate = false
  }

  gesture(interacting: boolean): void {
    this.interacting = interacting
    this.presentedAfterUpdate = false
  }

  updated(moving: boolean): void {
    this.moving = moving
    this.presentedAfterUpdate = false
  }

  presented(sequence: number, read: () => CameraFrameRead): void {
    this.frame += 1
    this.sequence = sequence
    this.presentedAfterUpdate = true
    if (this.first === null || sequence > this.first.sequence) {
      this.first = { ...read(), sequence, frame: this.frame }
    }
  }

  read(
    requestedSequence: number,
    outcomeSequence: number,
    pendingScene: number,
  ): CameraCompletionRead {
    return {
      idle:
        this.presentedAfterUpdate &&
        !this.moving &&
        !this.interacting &&
        pendingScene === 0 &&
        this.sequence === requestedSequence &&
        (requestedSequence === 0 || outcomeSequence === requestedSequence),
      moving: this.moving,
      interacting: this.interacting,
      requestedSequence,
      presentedSequence: this.sequence,
      outcomeSequence,
      pendingScene,
      frame: this.frame,
      firstRequestFrame: this.first,
    }
  }
}
