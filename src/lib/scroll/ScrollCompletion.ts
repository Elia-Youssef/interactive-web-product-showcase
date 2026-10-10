export type ScrollPosition = { readonly left: number; readonly top: number }
export type ScrollPlan = {
  readonly name: string
  readonly target: ScrollPosition
  readonly position: () => ScrollPosition
  readonly listenEnd: (end: () => void) => () => void
  readonly start: () => void
  readonly cancel: () => void
}
export type ScrollCompletionRead = {
  readonly generation: number
  readonly pending: number
  readonly scrollers: readonly {
    readonly name: string
    readonly target: ScrollPosition
    readonly position: ScrollPosition
    readonly pending: boolean
  }[]
}
type RunningScroll = { readonly plan: ScrollPlan; pending: boolean; release: () => void }

// A lull cannot complete a native smooth scroll. Register its end before
// starting it. Target retirement cancels only its still-owned motion;
// a stale target release cannot cancel a replacement or later visitor input.
export class ScrollCompletion {
  private generation = 0
  private running: RunningScroll[] = []

  start(plans: readonly ScrollPlan[]): () => void {
    this.release()
    this.generation += 1
    const generation = this.generation
    this.running = plans.map((plan) => {
      const position = plan.position()
      return {
        plan,
        pending: position.left !== plan.target.left || position.top !== plan.target.top,
        release: () => {},
      }
    })
    for (const item of this.running) {
      if (item.pending) {
        item.release = item.plan.listenEnd(() => {
          // Retirement may queue an end seen by a replacement listener.
          // Only this transaction's exact target can discharge its debt.
          const position = item.plan.position()
          if (position.left !== item.plan.target.left || position.top !== item.plan.target.top)
            return
          item.pending = false
          item.release()
        })
      }
    }
    for (const item of this.running) item.plan.start()
    return () => {
      if (this.generation === generation) this.release()
    }
  }

  read(): ScrollCompletionRead {
    return {
      generation: this.generation,
      pending: this.running.filter((item) => item.pending).length,
      scrollers: this.running.map(({ plan, pending }) => ({
        name: plan.name,
        target: plan.target,
        position: plan.position(),
        pending,
      })),
    }
  }

  release(): void {
    for (const item of this.running) {
      item.release()
      if (item.pending) {
        item.pending = false
        item.plan.cancel()
      }
    }
    this.running = []
  }
}
