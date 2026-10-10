// The stand-ins of the camera request channel tests: a flush of the
// microtasks a recorded move resolves through, a step frame schedule the
// test runs by hand, and a move promise the test settles.

// Flushes the microtasks a recorded move resolves through.
export async function settled(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

// A step frame schedule the test runs by hand.
export function stepFrames() {
  let pending: (() => void) | null = null
  return {
    schedule: (flush: () => void) => {
      pending = flush
      return () => {
        pending = null
      }
    },
    run: () => {
      const flush = pending
      pending = null
      flush?.()
    },
  }
}

export function defer(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}
