// The animation facts the explode contract's rules read from a product
// document: one fact per animation channel, as plain data, with the values
// the runtime would apply (a normalized accessor's values scaled back, a
// CUBICSPLINE track reduced to the value element of each key). The
// exploded-bounds reader and the clip's rule table entries both read these
// facts, so one pass over the document serves every rule.

import type { AnimationChannel, Document } from '@gltf-transform/core'
import { normalizedScaleOf } from './modelFacts.ts'

// One animation channel: the animation and node it belongs to, the
// transform path it drives, how many components one key holds (3 for
// translation and scale, 4 for a rotation quaternion), the key times in
// seconds, and the key values in the document's own units, one key after
// another.
export type ChannelFact = {
  readonly animationName: string
  readonly targetName: string
  readonly path: string
  readonly components: number
  readonly times: readonly number[]
  readonly keyValues: readonly number[]
}

// The components one path drives per key.
export function componentsOfPath(path: string): number {
  return path === 'rotation' ? 4 : 3
}

export function readAnimationFacts(doc: Document): readonly ChannelFact[] {
  const facts: ChannelFact[] = []
  for (const animation of doc.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      const fact = channelFactOf(animation.getName(), channel)
      if (fact !== null) {
        facts.push(fact)
      }
    }
  }
  return facts
}

// One channel's fact, or null when the channel cannot be read as a
// transform track (no target node, no sampler, or no decoded arrays): a
// channel the loader cannot bind reaches neither the runtime nor a rule.
function channelFactOf(animationName: string, channel: AnimationChannel): ChannelFact | null {
  const sampler = channel.getSampler()
  const input = sampler?.getInput() ?? null
  const output = sampler?.getOutput() ?? null
  const target = channel.getTargetNode()
  const times = input?.getArray() ?? null
  const values = output?.getArray() ?? null
  if (sampler === null || input === null || output === null || target === null) {
    return null
  }
  if (times === null || values === null) {
    return null
  }
  const path = channel.getTargetPath() ?? ''
  return {
    animationName,
    targetName: target.getName(),
    path,
    components: componentsOfPath(path),
    times: Array.from(times, (time) => time),
    keyValues: keyValuesOf(
      values,
      output.getNormalized() ? normalizedScaleOf(output) : 1,
      sampler.getInterpolation(),
      componentsOfPath(path),
    ),
  }
}

// The per-key value elements of an output accessor: every key's value
// alone, so a CUBICSPLINE track's tangents stay out of the facts and every
// interpolation reads the same shape.
function keyValuesOf(
  values: Readonly<ArrayLike<number>>,
  scale: number,
  interpolation: string | null,
  components: number,
): readonly number[] {
  const keyCount = values.length / (interpolation === 'CUBICSPLINE' ? components * 3 : components)
  const out: number[] = []
  for (let key = 0; key < keyCount; key += 1) {
    const base =
      interpolation === 'CUBICSPLINE' ? key * components * 3 + components : key * components
    for (let component = 0; component < components; component += 1) {
      out.push((values[base + component] ?? 0) * scale)
    }
  }
  return out
}
