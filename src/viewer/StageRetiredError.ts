// A terminal frame supply, whether its renderer retired or its owner left.
// Every waiter in that lifetime receives the same typed reason unchanged.
export class StageRetiredError extends Error {
  constructor(readonly reason: 'retired' | 'disposed') {
    super(`the stage frame supply was ${reason} before a requested frame was recorded`)
    this.name = 'StageRetiredError'
  }
}
