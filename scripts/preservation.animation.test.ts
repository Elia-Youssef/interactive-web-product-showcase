import path from 'node:path'
import type { Document } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { createModelIO } from './modelIo.ts'
import { withTempDir, writeOptimizedModel } from './optimizedModel.fixtures.ts'
import { preservationFixture } from './preservation.fixtures.ts'
import { translationKeyComponentBound } from './storageBounds.ts'
import { ANIMATION_RESAMPLE_TOLERANCE } from './settings.ts'
import { findPreservationLosses, readProductPreservation } from './preservationCompare.ts'

function trackIn(doc: Document) {
  const animation = doc.getRoot().listAnimations()[0]
  const sampler = animation?.listSamplers()[0]
  const channel = animation?.listChannels()[0]
  const input = sampler?.getInput()
  const output = sampler?.getOutput()
  if (
    sampler === undefined ||
    channel === undefined ||
    input === null ||
    input === undefined ||
    output === null ||
    output === undefined
  )
    throw new Error('missing fixture track')
  return { sampler, channel, input, output }
}

function setTrack(
  doc: Document,
  interpolation: 'STEP' | 'LINEAR' | 'CUBICSPLINE',
  times: number[],
  values: number[],
  path: 'translation' | 'rotation' | 'scale' = 'translation',
): void {
  const track = trackIn(doc)
  track.sampler.setInterpolation(interpolation)
  track.channel.setTargetPath(path)
  track.input.setArray(new Float32Array(times))
  track.output.setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(new Float32Array(values))
}

describe('complete authored animation data', () => {
  it('rejects an interior timing change with the clip endpoints unchanged', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    trackIn(doc).input.setArray(new Float32Array([0, 0.25, 0.75, 1]))
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual(
      expect.arrayContaining([expect.stringContaining('animation channel changed:')]),
    )
  })

  it('rejects a transform path change with target, timing and values unchanged', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    trackIn(doc).channel.setTargetPath('scale')
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual(
      expect.arrayContaining([expect.stringContaining('animation channel changed:')]),
    )
  })

  it('accepts removal of redundant STEP keys', () => {
    const doc = preservationFixture()
    setTrack(doc, 'STEP', [0, 0.25, 0.5, 1], [0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0, 0])
    const before = readProductPreservation(doc)
    setTrack(doc, 'STEP', [0, 0.5, 1], [0, 0, 0, 0.2, 0, 0, 0.2, 0, 0])
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual([])
  })

  it('rejects a shifted STEP discontinuity with identical endpoints', () => {
    const doc = preservationFixture()
    setTrack(doc, 'STEP', [0, 0.5, 1], [0, 0, 0, 0.2, 0, 0, 0.2, 0, 0])
    const before = readProductPreservation(doc)
    trackIn(doc).input.setArray(new Float32Array([0, 0.75, 1]))
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual(
      expect.arrayContaining([expect.stringContaining('animation channel changed:')]),
    )
  })

  it('rejects changed cubic tangents with all key values unchanged', () => {
    const doc = preservationFixture()
    const values = [
      0, 0, 0, 0.013, 0.027, 0.039, 0.1, 0.2, 0.3, 0.1, 0.2, 0.3, 0.213, 0.127, 0.139, 0, 0, 0,
    ]
    setTrack(doc, 'CUBICSPLINE', [0, 1], values)
    const before = readProductPreservation(doc)
    values[6] = 10
    trackIn(doc).output.setArray(new Float32Array(values))
    const after = readProductPreservation(doc)
    expect(after.structure.animationChannels[0]?.keyValues).toEqual(
      before.structure.animationChannels[0]?.keyValues,
    )
    expect(findPreservationLosses(before, after)).toEqual(
      expect.arrayContaining([expect.stringContaining('animation channel changed:')]),
    )
  })

  it('accepts cubic translation storage while retaining its tangents', async () => {
    await withTempDir(async (dir) => {
      const doc = preservationFixture()
      setTrack(
        doc,
        'CUBICSPLINE',
        [0, 1],
        [
          0, 0, 0, 0.013, 0.027, 0.039, 0.11, 0.23, 0.31, 0.13, 0.21, 0.33, 0.213, 0.127, 0.139, 0,
          0, 0,
        ],
      )
      const before = readProductPreservation(doc)
      const file = path.join(dir, 'candidate.glb')
      await writeOptimizedModel(doc, file)
      const io = await createModelIO()
      expect(findPreservationLosses(before, readProductPreservation(await io.read(file)))).toEqual(
        [],
      )
    })
  })

  it.each(['rotation', 'scale'] as const)(
    'accepts the installed %s filter round trip',
    async (pathName) => {
      await withTempDir(async (dir) => {
        const doc = preservationFixture()
        const values =
          pathName === 'rotation'
            ? [0, 0, 0, 1, 0, Math.sin(0.27), 0, Math.cos(0.27)]
            : [1, 1, 1, 1.137, 1.241, 1.319]
        setTrack(doc, 'LINEAR', [0, 1], values, pathName)
        const before = readProductPreservation(doc)
        const file = path.join(dir, 'candidate.glb')
        await writeOptimizedModel(doc, file)
        const io = await createModelIO()
        const after = readProductPreservation(await io.read(file))
        expect(after.semantics.tracks[0]?.values).not.toEqual(before.semantics.tracks[0]?.values)
        expect(findPreservationLosses(before, after)).toEqual([])
      })
    },
  )

  it('rejects a changed rotation key', () => {
    const doc = preservationFixture()
    setTrack(doc, 'LINEAR', [0, 1], [0, 0, 0, 1, 0, Math.sin(0.27), 0, Math.cos(0.27)], 'rotation')
    const before = readProductPreservation(doc)
    trackIn(doc).output.setArray(new Float32Array([0, 0, 0, 1, 0, 1, 0, 0]))
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual(
      expect.arrayContaining([expect.stringContaining('animation channel changed:')]),
    )
  })

  it('rejects a key change outside the shared resampling and storage budget', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    const track = trackIn(doc)
    const values = Array.from(track.output.getArray() ?? [])
    const key = values.slice(-3)
    const bound = ANIMATION_RESAMPLE_TOLERANCE + translationKeyComponentBound(key)
    values[values.length - 3] = (key[0] ?? 0) + 2 * bound
    track.output.setArray(new Float32Array(values))
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual(
      expect.arrayContaining([expect.stringContaining('animation channel changed:')]),
    )
  })

  it.each(['missing output', 'nonfinite output', 'nonmonotonic times'])(
    'fails loudly on %s',
    (problem) => {
      const doc = preservationFixture()
      const track = trackIn(doc)
      if (problem === 'missing output') track.sampler.setOutput(null)
      if (problem === 'nonfinite output') track.output.setArray(new Float32Array(12).fill(NaN))
      if (problem === 'nonmonotonic times')
        track.input.setArray(new Float32Array([0, 0.25, 0.25, 1]))
      expect(() => readProductPreservation(doc)).toThrow(/animation/)
    },
  )
})
