import { AnimationMixer, type AnimationClip, type Object3D } from 'three/webgpu'
import { frameSpanOfMeshBoxes } from '@lib/camera/frame'
import type { MeshBox, ModelBounds } from '@lib/camera/frame'
import { carriesGeometry, worldBoxOf } from '../modelFrame'

// The bounds of the product's parts at the explode clip's last key, read
// once at parse, never per frame: every PART_ subtree's geometry boxes at
// the fully exploded pose, the SHADOW subtree excluded (the viewer has
// faded it out by that end of the clip, so it does not reach). This is the
// model half of the home view's reach rule at the explode's end: the
// runtime plan feeds these bounds to the same contract assembly the
// build-time validate step feeds its own reading of the model bytes.
//
// The pose is sampled the way the exploded view presents it: a paused
// mixer holding the clip as a playing action, its time set to the
// duration (exactly the last key the progress map lands on), one update
// with zero elapsed. The mixer is released before the return, and three
// restores every bound property to what it held before the binding, so
// the parse leaves the scene at the rest pose it found.
export function explodedBoundsOf(
  scene: Object3D,
  clip: AnimationClip,
  parts: ReadonlyMap<string, Object3D>,
  shadow: Object3D,
): ModelBounds | null {
  const mixer = new AnimationMixer(scene)
  const action = mixer.clipAction(clip)
  action.play()
  action.paused = true
  action.time = clip.duration
  mixer.update(0)
  scene.updateMatrixWorld(true)
  const boxes = partMeshBoxes(parts, shadow)
  // The span is folded while the pose still holds: a mesh box carries its
  // object's live world-matrix elements, so restoring the scene first
  // would fold the rest pose's matrices into the exploded bounds.
  const span = boxes.length === 0 ? null : frameSpanOfMeshBoxes(boxes)
  action.stop()
  mixer.uncacheClip(clip)
  mixer.uncacheRoot(scene)
  scene.updateMatrixWorld(true)
  if (span === null) {
    return null
  }
  return { min: span.min, max: span.max }
}

// Every geometry box under a part subtree, skipping the shadow's subtree:
// the frame measure's own selection and its own box read, so the bounds
// measure the same model the frame does.
function partMeshBoxes(parts: ReadonlyMap<string, Object3D>, shadow: Object3D): MeshBox[] {
  const boxes: MeshBox[] = []
  for (const part of parts.values()) {
    part.traverse((node) => {
      if (!carriesGeometry(node) || sitsUnder(node, shadow)) {
        return
      }
      boxes.push(worldBoxOf(node))
    })
  }
  return boxes
}

// Whether the node is the shadow itself or sits in its subtree.
function sitsUnder(node: Object3D, shadow: Object3D): boolean {
  for (let current: Object3D | null = node; current !== null; current = current.parent) {
    if (current === shadow) {
      return true
    }
  }
  return false
}
