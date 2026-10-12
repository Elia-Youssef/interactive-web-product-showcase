import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type RootState } from '@react-three/fiber'
import type {
  FrameFailureReport,
  FrameOwnerScope,
  PresentedFrameListener,
  StageFramePath,
} from './StageFramePath'

// The context that hands the stage's frame path to the in-canvas content:
// the stage's frames provide it inside the Canvas, so every frame callback
// of the content and the product's failure ownership reach the one path of
// the canvas they render in.
export const StageFramePathContext = createContext<StageFramePath | null>(null)

// The render priority of the stage's present: the last step of every
// frame. A positive priority takes the render out of R3F's hands (its loop
// renders only while no subscriber holds one), so the present is the
// stage's own step, run through the frame path like every other.
export const STAGE_PRESENT_PRIORITY = 1

export function useStageFramePath(): StageFramePath {
  const frames = useContext(StageFramePathContext)
  if (frames === null) {
    throw new Error('a component that runs on the stage frames renders outside the stage')
  }
  return frames
}

// A frame callback run on every frame the stage renders, through the
// stage's frame path, as code of the named scope: a callback that throws
// halts the stage's frames and fails that scope's owner, instead of
// escaping the engine's frame loop as a page error. The scope is whose code
// it is, never left to default: the stage's own machinery (its camera, its
// warm-up) names the stage, a product's features name the content. The
// priority orders it among the frame's steps the way R3F's own does, lower
// first; every step runs before the present, so a priority at or past the
// present's is a composition error.
//
// The step handed to the frame path is built once per hook: the frame
// callback stamps the frame's state and delta on the holder first, so a
// frame runs the latest committed callback without wrapping it in a fresh
// closure. The holder takes a committed render's scope and callback in a
// layout effect, and frames run between commits, so a render React threw
// away never runs and a committed one never runs stale.
type StageFrameHolder = {
  scope: FrameOwnerScope
  callback: (state: RootState, deltaSeconds: number) => void
  state: RootState | null
  deltaSeconds: number
}

export function useStageFrame(
  scope: FrameOwnerScope,
  callback: (state: RootState, deltaSeconds: number) => void,
  priority = 0,
): void {
  const frames = useStageFramePath()
  if (priority >= STAGE_PRESENT_PRIORITY) {
    throw new Error(
      `a stage frame callback runs before the present: its priority ${priority} must stay below ${STAGE_PRESENT_PRIORITY}`,
    )
  }
  const holder = useRef<StageFrameHolder>({ scope, callback, state: null, deltaSeconds: 0 })
  useLayoutEffect(() => {
    holder.current.scope = scope
    holder.current.callback = callback
  })
  const step = useMemo(() => {
    const runStep = (): void => {
      const current = holder.current
      if (current.state === null) {
        throw new Error('a stage frame step ran before its frame stamped the frame state')
      }
      current.callback(current.state, current.deltaSeconds)
    }
    return runStep
  }, [holder])
  useFrame((state, delta) => {
    const current = holder.current
    current.state = state
    current.deltaSeconds = delta
    frames.run(current.scope, step)
  }, priority)
}

// Owns the stage's frame failures in the scope for as long as the calling
// component is mounted: a frame that throws in that time reaches the report
// once, unless a narrower scope owns the frames. The registration runs as a
// layout effect, in the commit that puts the owner's content in the scene,
// so no frame can present that content before its owner is registered, and
// the unmount that takes the content out lets go in the same commit, which
// presents the stage again when this owner's content failure halted it.
export function useStageFrameFailures(scope: FrameOwnerScope, report: FrameFailureReport): void {
  const frames = useStageFramePath()
  useLayoutEffect(() => frames.own(scope, report), [frames, scope, report])
}

// The post-present phase content subscribes to: it runs the listener once
// after every frame the stage presented, for as long as the calling
// component's effects are live, through the stage's frame path as code of
// the named scope, never after a frame that failed or was skipped, and a
// listener that throws fails that scope's owner and halts the frames like a
// frame callback. It is the one way code observes a presented frame, the
// landing point for a pass that must read what the frame just drew, such
// as an overlay placed over the presented scene. Subscribing owes one
// frame, so a listener that arrives while the stage is at rest still gets
// its first frame; the listener's identity joins the effect, so pass a
// stable one.
export function usePresentedFrame(scope: FrameOwnerScope, listener: PresentedFrameListener): void {
  const frames = useStageFramePath()
  useEffect(() => frames.listen(scope, listener), [frames, scope, listener])
}
