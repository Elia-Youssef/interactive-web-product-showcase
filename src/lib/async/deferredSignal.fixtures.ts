// A test-owned boundary: resolving it acknowledges one observed event.
export function deferredSignal(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((release) => {
    resolve = release
  })
  return { promise, resolve }
}
