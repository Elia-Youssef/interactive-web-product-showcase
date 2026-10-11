import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { MeshoptEncoder } from 'meshoptimizer'
import { geometryTransforms } from './geometryOptimize.ts'
import { createModelIO } from './modelIo.ts'
import { withTempDir } from './optimizedModel.fixtures.ts'
import { namedNode, preservationFixture } from './preservation.fixtures.ts'
import { findPreservationLosses, readProductPreservation } from './preservationCompare.ts'
import { ANIMATION_RESAMPLE_TOLERANCE, DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'

function bakedCurve(amplitude: number) {
  const doc = preservationFixture()
  namedNode(doc, 'PART_body').setTranslation([0, 0.08, 0])
  const sampler = doc.getRoot().listAnimations()[0]?.listSamplers()[0]
  if (sampler === undefined) throw new Error('missing fixture sampler')
  const times = Array.from({ length: 121 }, (_, index) => index / 120)
  sampler.getInput()?.setArray(new Float32Array(times))
  sampler
    .getOutput()
    ?.setArray(
      new Float32Array(times.flatMap((time) => [amplitude * Math.sin(Math.PI * time), 0.08, 0])),
    )
  return doc
}

describe('resampled model storage', { timeout: TOOL_FIXTURE_TIMEOUT_MS }, () => {
  it('keeps every original key when greedy thinning exceeds the declared curve tolerance', async () => {
    await withTempDir(async (dir) => {
      const doc = bakedCurve(ANIMATION_RESAMPLE_TOLERANCE * 1.8)
      const before = readProductPreservation(doc)
      const original = before.semantics.tracks[0]
      await doc.transform(...geometryTransforms(DEFAULT_OPTIMIZE_SETTINGS))
      const resampled = readProductPreservation(doc).semantics.tracks[0]
      const io = await createModelIO()
      io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
      const candidate = path.join(dir, 'candidate.glb')
      await io.write(candidate, doc)
      expect(
        findPreservationLosses(before, readProductPreservation(await io.read(candidate))),
      ).toEqual([])
      expect(resampled?.times).toEqual(original?.times)
      expect(resampled?.values).toEqual(original?.values)
    })
  })
})

it('keeps the greedy output when every original key is within the declared tolerance', async () => {
  const doc = bakedCurve(ANIMATION_RESAMPLE_TOLERANCE * 0.8)
  const before = readProductPreservation(doc)
  await doc.transform(...geometryTransforms(DEFAULT_OPTIMIZE_SETTINGS))
  const after = readProductPreservation(doc)
  expect(after.semantics.tracks[0]?.times).toHaveLength(2)
  expect(findPreservationLosses(before, after)).toEqual([])
})

it('reads the supplied tolerance for both thinning and the whole channel decision', async () => {
  const tolerance = ANIMATION_RESAMPLE_TOLERANCE / 2
  const doc = bakedCurve(tolerance * 1.8)
  const original = readProductPreservation(doc).semantics.tracks[0]
  await doc.transform(
    ...geometryTransforms({ ...DEFAULT_OPTIMIZE_SETTINGS, resampleTolerance: tolerance }),
  )
  expect(readProductPreservation(doc).semantics.tracks[0]?.times).toEqual(original?.times)
})

it('verifies each channel independently when channels share their original time accessor', async () => {
  const doc = bakedCurve(ANIMATION_RESAMPLE_TOLERANCE * 1.8)
  const animation = doc.getRoot().listAnimations()[0]
  const channel = animation?.listChannels()[0]
  const sampler = channel?.getSampler()
  const output = sampler?.getOutput()
  if (
    animation === undefined ||
    channel === undefined ||
    sampler === null ||
    sampler === undefined ||
    output === null ||
    output === undefined
  )
    throw new Error('missing fixture channel')
  const other = namedNode(doc, 'PART_other').setTranslation([0, 0.08, 0])
  const values = Array.from(output.getArray() ?? [], (value, index) =>
    index % 3 === 0 ? value / 3 : value,
  )
  const thinnable = sampler.clone().setOutput(output.clone().setArray(new Float32Array(values)))
  animation
    .addSampler(thinnable)
    .addChannel(channel.clone().setTargetNode(other).setSampler(thinnable))
  const before = readProductPreservation(doc)
  await doc.transform(...geometryTransforms(DEFAULT_OPTIMIZE_SETTINGS))
  const after = readProductPreservation(doc)
  expect(after.semantics.tracks.map((track) => track.times.length)).toEqual([121, 2])
  expect(findPreservationLosses(before, after)).toEqual([])
})
