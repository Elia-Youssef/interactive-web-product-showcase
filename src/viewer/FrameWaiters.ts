import { StageRetiredError } from './StageRetiredError'

type FrameWaiter = {
  readonly resolve: () => void
  readonly reject: (reason: StageRetiredError) => void
}

type WaiterOwner = {
  readonly failure: () => StageRetiredError | null
  readonly pending: () => void
  readonly drained: () => void
}

// Waiters belonging to one frame supply lifetime. A closed lifetime never
// reopens: late waiters receive its original reason, and later frames
// cannot resolve rejected work. Closing releases it from the owning clock.
export class FrameWaiters {
  private readonly pending: FrameWaiter[] = []
  private failure: StageRetiredError | null = null

  constructor(private readonly owner: WaiterOwner) {}

  onceFrame(): Promise<void> {
    const failure = this.failure ?? this.owner.failure()
    if (failure !== null) {
      return Promise.reject(failure)
    }
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ resolve, reject })
      this.owner.pending()
    })
  }

  recordFrame(): void {
    if (this.failure !== null || this.owner.failure() !== null) {
      return
    }
    for (const waiter of this.pending.splice(0)) {
      waiter.resolve()
    }
    this.owner.drained()
  }

  readonly retire = (): void => this.end(new StageRetiredError('retired'))
  readonly dispose = (): void => this.end(new StageRetiredError('disposed'))

  end(reason: StageRetiredError): void {
    if (this.failure !== null) {
      return
    }
    this.failure = reason
    for (const waiter of this.pending.splice(0)) {
      waiter.reject(reason)
    }
    this.owner.drained()
  }
}
