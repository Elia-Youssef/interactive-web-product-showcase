import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { StrictMode } from 'react'
import type { ProductTransitionPhase } from '../../src/lib/transition'
import { useMotionCallbacks } from '../../src/ui/useMotionCallbacks'

type MotionCase = {
  readonly phase: ProductTransitionPhase
  readonly reducedMotion: boolean
  readonly motion: 'empty' | 'finished' | 'pending'
}

const animationDurationMs = 1000

// Real React commits, cleanup and native animation promises. Every case
// unmounts in the same turn as its layout setup, before any end can pay.
export async function callbacksAfterUnmount({ phase, reducedMotion, motion }: MotionCase) {
  const callbacks: string[] = []
  const animations: Animation[] = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  function Mover() {
    const mover = useMotionCallbacks({
      phase,
      reducedMotion,
      onCovered: () => callbacks.push('covered'),
      onRevealed: () => callbacks.push('revealed'),
    })
    return (
      <div
        ref={(element) => {
          mover.current = element
          if (element !== null && motion !== 'empty') {
            const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: reducedMotion ? 0 : animationDurationMs,
              fill: 'forwards',
            })
            animation.pause()
            animations.push(animation)
            if (motion === 'finished') {
              animation.finish()
            }
          }
        }}
      />
    )
  }
  flushSync(() =>
    root.render(
      <StrictMode>
        <Mover />
      </StrictMode>,
    ),
  )
  flushSync(() => root.unmount())
  animations.forEach((animation) => animation.finish())
  await Promise.all(animations.map((animation) => animation.finished))
  await new Promise<void>((resolve) => queueMicrotask(resolve))
  animations.forEach((animation) => animation.cancel())
  container.remove()
  return callbacks
}
