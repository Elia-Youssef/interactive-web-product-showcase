import { beforeEach, expect, it, vi } from 'vitest'
import type { ProductTransitionPhase } from '@lib/transition'
import { useMotionCallbacks } from './useMotionCallbacks'

function defer() {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const hooks = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  finished: [] as Promise<void>[],
}))

vi.mock('react', () => ({
  useRef: (current: unknown) => ({
    current:
      current === null
        ? { getAnimations: () => hooks.finished.map((finished) => ({ finished })) }
        : current,
  }),
  useEffect: (setup: () => void) => hooks.effects.push(setup),
  useLayoutEffect: (setup: () => void | (() => void)) => hooks.effects.push(setup),
}))

beforeEach(() => {
  hooks.effects = []
})

function Mount(phase: ProductTransitionPhase, reducedMotion: boolean, finished: Promise<void>[]) {
  const onCovered = vi.fn()
  const onRevealed = vi.fn()
  hooks.finished = finished
  useMotionCallbacks({ phase, reducedMotion, onCovered, onRevealed })
  const cleanups = hooks.effects.map((setup) => setup())
  return {
    onCovered,
    onRevealed,
    unmount: () => cleanups.forEach((cleanup) => cleanup?.()),
  }
}

for (const phase of ['covering', 'revealing'] as const) {
  for (const reducedMotion of [false, true]) {
    for (const motion of ['empty', 'finished', 'pending'] as const) {
      it(`invalidates ${phase} after cleanup with ${motion} animation and reduced motion ${reducedMotion}`, async () => {
        const pending = defer()
        const finished =
          motion === 'empty' ? [] : [motion === 'finished' ? Promise.resolve() : pending.promise]
        const mounted = Mount(phase, reducedMotion, finished)
        mounted.unmount()
        pending.resolve()
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(mounted.onCovered).not.toHaveBeenCalled()
        expect(mounted.onRevealed).not.toHaveBeenCalled()
      })
    }

    it(`pays ${phase} exactly once from an active animation with reduced motion ${reducedMotion}`, async () => {
      const pending = defer()
      const mounted = Mount(phase, reducedMotion, [pending.promise])
      expect(mounted.onCovered).not.toHaveBeenCalled()
      expect(mounted.onRevealed).not.toHaveBeenCalled()
      pending.resolve()
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(mounted.onCovered).toHaveBeenCalledTimes(phase === 'covering' ? 1 : 0)
      expect(mounted.onRevealed).toHaveBeenCalledTimes(phase === 'revealing' ? 1 : 0)
      mounted.unmount()
    })
  }
}
