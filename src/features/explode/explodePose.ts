import { AnimationMixer } from 'three/webgpu'
import type { AnimationClip, Object3D } from 'three/webgpu'
import { explodeClipTime } from '@lib/explode'

// The paused-mixer pose driver of the exploded view: one AnimationMixer on
// the loaded scene, holding the product's one clip as a playing but paused
// action, so applying a progress only re-evaluates the pose at the mapped
// time and never advances the clip on its own.

export type ExplodePose = {
  // Applies the pose at the normalized progress: the mapped clip time is
  // set on the action and the mixer updates with zero elapsed time, so only
  // the bound transforms change. Progress outside [0, 1] fails with the
  // map's typed error; it is never clamped into the clip.
  readonly apply: (t: number) => void
  // Stops the action, then uncaches the clip and the root. three restores
  // every bound property to what it held before the binding, so disposing
  // leaves the scene as the feature found it.
  readonly dispose: () => void
}

// Creates the pose driver for one loaded scene and its clip. Called from an
// effect, never during render: a resource created during render must never
// be released in a cleanup.
export function createExplodePose(root: Object3D, clip: AnimationClip): ExplodePose {
  const mixer = new AnimationMixer(root)
  const action = mixer.clipAction(clip)
  action.play()
  action.paused = true

  return {
    apply(t) {
      action.time = explodeClipTime(t, clip.duration)
      mixer.update(0)
    },
    dispose() {
      action.stop()
      mixer.uncacheClip(clip)
      mixer.uncacheRoot(root)
    },
  }
}
