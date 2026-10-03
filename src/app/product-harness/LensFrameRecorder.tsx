import { useCallback, useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera } from 'three'
import { usePresentedFrame } from '@viewer/stageFrameContext'

// The dev-only lens recorder the eased-lens proof reads: once started, it
// records the vertical fov every presented frame drew with, one entry per
// frame, from the stage's post-present phase. The phase runs only after a
// frame that presented, after every frame step wrote the camera, so each
// entry is exactly the lens of one presented frame: no frame is missed and
// none is sampled twice, which a page-side sampler on its own clock cannot
// promise. The fov is the camera's effective one, the zoom the controls
// present included, so it is the lens the viewer saw. Dev-only, like the
// harness that mounts it.
export function LensFrameRecorder() {
  const camera = useThree((state) => state.camera)
  const [recording] = useState(createLensRecording)

  const record = useCallback(() => {
    if (!(camera instanceof PerspectiveCamera)) {
      throw new Error('the lens recorder needs the stage camera to be a perspective camera')
    }
    recording.record(MathUtils.degToRad(camera.getEffectiveFOV()))
  }, [camera, recording])
  usePresentedFrame('stage', record)

  useEffect(() => {
    window.__harnessLensFrames = recording.recorder
    return () => {
      if (window.__harnessLensFrames === recording.recorder) {
        delete window.__harnessLensFrames
      }
    }
  }, [recording])

  return null
}

// The recorder the page sees: start opens a fresh recording, take hands
// the lens of every frame presented since then back and closes it.
export type HarnessLensRecorder = {
  readonly start: () => void
  readonly take: () => readonly number[]
}

type LensRecording = {
  readonly record: (fovY: number) => void
  readonly recorder: HarnessLensRecorder
}

// One recording per recorder mount. Closed until started, so the frames of
// a test's setup cost one comparison each and keep nothing.
function createLensRecording(): LensRecording {
  let frames: number[] | null = null
  return {
    record: (fovY) => {
      frames?.push(fovY)
    },
    recorder: {
      start: () => {
        frames = []
      },
      take: () => {
        if (frames === null) {
          throw new Error('the lens recorder was taken without a start')
        }
        const taken = frames
        frames = null
        return taken
      },
    },
  }
}

declare global {
  interface Window {
    __harnessLensFrames?: HarnessLensRecorder
  }
}
