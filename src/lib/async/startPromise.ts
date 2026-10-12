// Starts an asynchronous step whose first part runs in the call itself: a
// start that throws before it returns its promise becomes that promise's
// rejection, so the caller meets every failure in the one channel, and what
// the start begins synchronously still begins before the call returns.
export function startPromise<Value>(start: () => PromiseLike<Value> | Value): Promise<Value> {
  return new Promise<Value>((resolve) => {
    resolve(start())
  })
}
