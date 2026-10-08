import { expect, test } from 'vitest'
import { AnimationClip, Object3D, VectorKeyframeTrack } from 'three/webgpu'
import { ExplodeRangeError } from '@lib/explode'
import { createExplodePose } from './explodePose'

// A two-key clip over one part: assembled at the origin, exploded one unit
// up at the last key. The part starts at a rest pose that differs from both
// keys, so the test can tell applied poses from untouched transforms and
// prove the restore on dispose.
function partScene(): { root: Object3D; part: Object3D } {
  const root = new Object3D()
  root.name = 'root'
  const part = new Object3D()
  part.name = 'PART_a'
  part.position.set(9, 9, 9)
  root.add(part)
  return { root, part }
}

function explodeClip(): AnimationClip {
  const track = new VectorKeyframeTrack('PART_a.position', [0, 1], [0, 0, 0, 1, 2, 3])
  return new AnimationClip('Explode', 1, [track])
}

test('the assembled pose is the clip first keyframe', () => {
  const { root, part } = partScene()
  const pose = createExplodePose(root, explodeClip())

  pose.apply(0)

  expect(part.position.toArray()).toEqual([0, 0, 0])
  pose.dispose()
})

test('mid progress interpolates between the keys', () => {
  const { root, part } = partScene()
  const pose = createExplodePose(root, explodeClip())

  pose.apply(0.5)

  expect(part.position.toArray()).toEqual([0.5, 1, 1.5])
  pose.dispose()
})

test('the exploded pose is the clip last keyframe', () => {
  const { root, part } = partScene()
  const pose = createExplodePose(root, explodeClip())

  pose.apply(1)

  expect(part.position.toArray()).toEqual([1, 2, 3])
  pose.dispose()
})

test('a progress out of range fails with the typed error, never clamps', () => {
  const { root } = partScene()
  const pose = createExplodePose(root, explodeClip())

  expect(() => pose.apply(1.001)).toThrowError(ExplodeRangeError)
  expect(() => pose.apply(-0.001)).toThrowError(ExplodeRangeError)
  pose.dispose()
})

test('disposing restores the transforms the scene held before the binding', () => {
  const { root, part } = partScene()
  const pose = createExplodePose(root, explodeClip())
  pose.apply(1)
  expect(part.position.toArray()).toEqual([1, 2, 3])

  pose.dispose()

  expect(part.position.toArray()).toEqual([9, 9, 9])
})
