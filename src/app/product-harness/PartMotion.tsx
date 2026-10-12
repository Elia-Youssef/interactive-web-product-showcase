import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import { useStageFrame } from '@viewer/stageFrameContext'

// How many frames the part moves for, and how far per frame. A few frames
// of visible travel: long enough that a placement written anywhere but the
// presented frame's post-present phase lags the final pose by a measurable
// step, short enough that the motion ends well inside a test's settle
// window.
const PART_MOVE_FRAMES = 12
const PART_MOVE_STEP_M = 0.01

// The dev-only part motion the order contract is proven with: it moves the
// part the product's first hotspot rides from its own frame callback, for a
// few frames, and then stops. The motion is the class of the exploded
// view's: a node that moves in a frame callback, so only a placement written
// after the render lands on the final pose. The callback is the product's
// content code on the stage's frame path, so a throw in it fails the
// product instead of escaping the frame loop.
export function PartMotion() {
  const loaded = useLoadedProduct()
  const invalidate = useThree((state) => state.invalidate)
  const moved = useRef(0)
  const part = loaded.rig.hotspots[0]?.part

  // Under demand mode a frame callback that mounts without touching the
  // scene graph owes its first frame: nothing else invalidates for it.
  useEffect(() => {
    invalidate()
  }, [invalidate])

  useStageFrame('content', () => {
    if (part === undefined || moved.current >= PART_MOVE_FRAMES) {
      return
    }
    part.position.z += PART_MOVE_STEP_M
    moved.current += 1
    // One more frame is owed only when another move follows: the last move
    // rides the frame the previous invalidate scheduled, like the explode
    // spring's settle. The last rendered frame therefore presents the final
    // pose with nothing scheduled after it.
    if (moved.current < PART_MOVE_FRAMES) {
      invalidate()
    }
  })

  return null
}
