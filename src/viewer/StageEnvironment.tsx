import { useEffect, use } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three/webgpu'
import { installCanvasLifeEnvironment } from './canvasLifeEnvironment'
import { useStageEnvironmentEntry } from './stageEnvironmentProvider'
import { isStageRenderer } from './stageIdentity'
import { useStageSettle } from './stageSettleContext'
import { reportStageSettleFailure } from './reportStageSettleFailure'

// The stage's lighting: the studio environment preprocessed into the PMREM
// the node pipeline samples, on the scene for reflections only, never a
// background. The preprocessing runs here, at
// load, with the renderer's own generator: left to the node system it
// happens lazily inside the first render that samples it, and under demand
// mode the stage would come to rest on a frame the environment had not
// reached yet.
//
// The source comes out of the stage's environment entry, held for the
// stage's whole life by the provider above the canvas lives: the stage's
// texture is disposed and the entry forgotten when the stage itself is
// gone, and a canvas life the stage replaces re-reads the live entry
// instead of loading again. The renderer never sees the stage's texture:
// each effect run prefilters a texture of its own over the same source and
// disposes it with the prefiltered result (canvasLifeEnvironment.ts).
//
// Assigning the environment is a scene mutation: the lit materials rebuild
// their render pipelines for it, so the assignment settles the stage, which
// presents the lit scene twice and holds the stage's settled promise until
// both frames are recorded.
export function StageEnvironment({
  onInstalled,
}: {
  readonly onInstalled: (installed: boolean) => void
}) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const settleScene = useStageSettle()
  // The load entry is the same object on every render while it is live, so
  // the suspension resumes on the very promise it suspended on.
  const entry = useStageEnvironmentEntry()
  const equirectangular = entry === null ? null : use(entry.value)

  useEffect(() => {
    if (equirectangular === null) {
      return
    }
    if (!isStageRenderer(gl)) {
      throw new Error('the stage environment needs the WebGPURenderer its factory built')
    }
    const uninstall = installCanvasLifeEnvironment({
      scene,
      stageTexture: equirectangular,
      prefilter: (source) => {
        const generator = new PMREMGenerator(gl)
        try {
          return generator.fromEquirectangular(source)
        } finally {
          generator.dispose()
        }
      },
    })
    let cancelled = false
    settleScene().then(undefined, (error: unknown) => {
      // An unmount during the settle drops the failure with the stage; a
      // live failure stays loud on the console for the console gate.
      if (cancelled) {
        return
      }
      reportStageSettleFailure(error, (failure) => {
        throw failure
      })
    })
    // Assignment and its queued settle precede admission of lit content;
    // presentation then settles behind the environment on the same chain.
    onInstalled(true)
    return () => {
      cancelled = true
      onInstalled(false)
      uninstall()
    }
  }, [gl, scene, settleScene, equirectangular, onInstalled])

  return null
}
