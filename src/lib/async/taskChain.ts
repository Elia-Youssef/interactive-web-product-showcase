// The serialized task chain: tasks pushed onto it run one after another in
// push order, each caller's promise resolves only when the whole chain has
// drained, and a task's rejection reaches that task's caller without
// stopping the chain. Pure promise bookkeeping, no timers, no task bodies of
// its own.

export type ChainTask = () => Promise<void>

export class TaskChain {
  // The chain's write end: the next task chains onto it. A rejected task
  // settles the tail too, so one failure never blocks the tasks after it.
  private tail: Promise<void> = Promise.resolve()
  // How many pushed tasks have not finished yet.
  private running = 0
  // Resolves when running falls back to zero. A push that arrives while the
  // chain runs joins the open drain, so a caller that reads the drain before
  // that push still waits for it.
  private drain: Promise<void> = Promise.resolve()
  private releaseDrain: (() => void) | null = null

  // Runs task after every task pushed before it. The returned promise
  // resolves when the task and the whole chain around it have drained, and
  // rejects with the task's own error if the task fails.
  push(task: ChainTask): Promise<void> {
    if (this.running === 0) {
      this.drain = new Promise<void>((resolve) => {
        this.releaseDrain = resolve
      })
    }
    this.running += 1
    const step = this.tail.then(task, task)
    this.tail = step.then(
      () => undefined,
      () => undefined,
    )
    const leave = (): void => {
      this.running -= 1
      if (this.running === 0) {
        this.releaseDrain?.()
        this.releaseDrain = null
      }
    }
    // The waiters keep the step's rejection from surfacing twice: the caller
    // below is its one loud channel.
    void step.then(leave, leave)
    return Promise.all([step, this.drain]).then(() => undefined)
  }
}
