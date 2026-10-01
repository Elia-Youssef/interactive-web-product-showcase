import type { Accessor, Animation } from '@gltf-transform/core'
import { createModelIO } from '../../scripts/modelIo.ts'
import { PART_PREFIX } from '../../src/lib/product/contractNames.ts'

// The committed model's explode facts, read in Node from the .glb the site
// ships, without the viewer in the loop: the first and last keyframe output
// of every animated PART_ node, dequantized exactly as the runtime loader
// dequantizes, so a runtime pose can be compared exactly against these
// values.

export type Vec3 = readonly [number, number, number]

export type ExplodeModelFacts = {
  readonly clipName: string
  readonly clipDurationSeconds: number
  // Local translation of every animated PART_ node, at the clip's first and
  // last keyframe.
  readonly firstPose: Readonly<Record<string, Vec3>>
  readonly lastPose: Readonly<Record<string, Vec3>>
}

// The scale the runtime loader multiplies normalized components by, keyed
// by the glTF component type. Mirrors the loader's own scale table for the
// integer types samplers quantize to.
const NORMALIZED_SCALE: Readonly<Record<number, number>> = {
  5120: 1 / 127, // BYTE
  5121: 1 / 255, // UNSIGNED_BYTE
  5122: 1 / 32767, // SHORT
  5123: 1 / 65535, // UNSIGNED_SHORT
}

const FLOAT_COMPONENT_TYPE = 5126

export async function readExplodeModelFacts(slug: string): Promise<ExplodeModelFacts> {
  const io = await createModelIO()
  const doc = await io.read(`public/models/${slug}/model.glb`)
  const animations = doc.getRoot().listAnimations()
  if (animations.length !== 1) {
    throw new Error(
      `expected exactly one animation in the ${slug} model, found ${animations.length}`,
    )
  }
  const animation = animations[0]
  if (animation === undefined) {
    throw new Error(`the animation of the ${slug} model is missing`)
  }

  const translations = new Map<string, Record<EndPose, Vec3>>()
  for (const channel of animation.listChannels()) {
    const name = channel.getTargetNode()?.getName()
    const path = channel.getTargetPath()
    const sampler = channel.getSampler()
    if (name === undefined || name === null || !name.startsWith(PART_PREFIX)) {
      continue
    }
    if (sampler === null || path === null) {
      throw new Error(`the ${name} channel of the Explode clip has no sampler or path`)
    }
    if (path === 'translation') {
      translations.set(name, {
        first: translationKey(sampler, 0),
        last: translationKey(sampler, -1),
      })
    }
  }
  if (translations.size === 0) {
    throw new Error(`the Explode clip of the ${slug} model animates no PART_ translation`)
  }

  const firstPose: Record<string, Vec3> = {}
  const lastPose: Record<string, Vec3> = {}
  for (const [name, pose] of translations) {
    firstPose[name] = pose.first
    lastPose[name] = pose.last
  }

  return {
    clipName: animation.getName(),
    clipDurationSeconds: clipDuration(animation),
    firstPose,
    lastPose,
  }
}

type EndPose = 'first' | 'last'

// One key's translation output as the Vec3 the facts carry. A negative key
// counts from the end, so the last key is -1 whatever the key count is.
function translationKey(
  sampler: { getInput(): Accessor | null; getOutput(): Accessor | null },
  key: number,
): Vec3 {
  const output = sampler.getOutput()
  if (output === null) {
    throw new Error('the animation channel has no output accessor')
  }
  const elementSize = output.getElementSize()
  if (elementSize !== 3) {
    throw new Error(`expected an output item size of 3, found ${elementSize}`)
  }
  const array = output.getArray()
  if (array === null) {
    throw new Error('the animation output accessor holds no array')
  }
  if (output.getComponentType() !== FLOAT_COMPONENT_TYPE && !output.getNormalized()) {
    throw new Error('a non-float, non-normalized animation output is not a supported sampler')
  }
  const scale = output.getNormalized() ? NORMALIZED_SCALE[output.getComponentType()] : 1
  if (scale === undefined) {
    throw new Error(
      `the output quantizes with an unsupported component type ${output.getComponentType()}`,
    )
  }
  const index = key < 0 ? keyCount(sampler) + key : key
  const values: number[] = []
  for (let i = 0; i < 3; i += 1) {
    const raw = array[index * 3 + i]
    if (raw === undefined) {
      throw new Error('the animation output is shorter than its key count')
    }
    values.push(Math.fround(raw * scale))
  }
  const [x, y, z] = values
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error('a translation keyframe without three components cannot be read')
  }
  return [x, y, z]
}

function keyCount(sampler: { getInput(): Accessor | null }): number {
  const input = sampler.getInput()
  if (input === null) {
    throw new Error('an animation sampler without an input accessor')
  }
  const array = input.getArray()
  if (array === null || array.length === 0) {
    throw new Error('an animation input accessor without keys')
  }
  return array.length
}

// The clip's full length: the largest time any sampler's input reaches,
// which is the duration the runtime loader computes from the same data.
function clipDuration(animation: Animation): number {
  let duration = 0
  for (const sampler of animation.listSamplers()) {
    const input = sampler.getInput()
    if (input === null) {
      throw new Error('an animation sampler without an input accessor')
    }
    const array = input.getArray()
    if (array === null || array.length === 0) {
      throw new Error('an animation input accessor without keys')
    }
    const last = array[array.length - 1]
    if (last === undefined) {
      throw new Error('an animation input accessor without a last key')
    }
    duration = Math.max(duration, last)
  }
  return duration
}
