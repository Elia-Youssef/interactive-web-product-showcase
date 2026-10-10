import type { Accessor, AnimationChannel, Document } from '@gltf-transform/core'
import { normalizedScaleOf } from './modelFacts.ts'

export type PreservationTrack = {
  clip: string
  target: string
  path: string
  interpolation: string
  components: number
  times: readonly number[]
  values: readonly number[]
}

function valuesOf(accessor: Accessor | null): number[] {
  const values = accessor?.getArray()
  if (accessor === null || values === null || values === undefined)
    throw new Error('an animation accessor has no decoded values')
  const scale = normalizedScaleOf(accessor)
  const result = Array.from(values, (value) => value * scale)
  if (!result.every(Number.isFinite)) throw new Error('an animation accessor has nonfinite values')
  return result
}

function trackOf(clip: string, channel: AnimationChannel): PreservationTrack {
  const sampler = channel.getSampler()
  const target = channel.getTargetNode()
  const path = channel.getTargetPath()
  if (sampler === null || target === null || path === null || target.getName() === '')
    throw new Error('an animation channel has no named target, path or sampler')
  const components = path === 'rotation' ? 4 : 3
  const interpolation = sampler.getInterpolation()
  const times = valuesOf(sampler.getInput())
  const values = valuesOf(sampler.getOutput())
  const multiplier = interpolation === 'CUBICSPLINE' ? 3 : 1
  if (
    times.length === 0 ||
    times.some((time, index) => index > 0 && time <= (times[index - 1] ?? time)) ||
    values.length !== times.length * components * multiplier
  )
    throw new Error('an animation sampler has invalid timing or output shape')
  if (!['translation', 'rotation', 'scale'].includes(path))
    throw new Error(`unsupported animation path ${path}`)
  return { clip, target: target.getName(), path, interpolation, components, times, values }
}

export function readPreservationTracks(doc: Document): PreservationTrack[] {
  return doc
    .getRoot()
    .listAnimations()
    .flatMap((animation) =>
      animation.listChannels().map((channel) => trackOf(animation.getName(), channel)),
    )
}
