import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { SUBPROCESS_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { runFixtureGltfCli } from './gltfCli.fixtures.ts'
import { createModelIO } from './modelIo.ts'
import { withTempDir } from './optimizedModel.fixtures.ts'
import { runOptimizePipeline } from './pipeline.ts'
import { namedNode, preservationFixture } from './preservation.fixtures.ts'
import { findPreservationLosses, readProductPreservation } from './preservationCompare.ts'
import { ANIMATION_RESAMPLE_TOLERANCE, DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'
import { translationKeyComponentBound } from './storageBounds.ts'

async function resampledFixture() {
  return withTempDir(async (dir) => {
    const doc = preservationFixture()
    namedNode(doc, 'PART_body').setTranslation([0, 0.08, 0])
    const sampler = doc.getRoot().listAnimations()[0]?.listSamplers()[0]
    if (sampler === undefined) throw new Error('missing fixture sampler')
    // Thirteen evenly baked keys still cover the curved motion and real
    // thinning; preservation checks the continuous track between keys too.
    const times = Array.from({ length: 13 }, (_, index) => index / 12)
    const values = times.flatMap((time) => [
      ANIMATION_RESAMPLE_TOLERANCE * 0.8 * Math.sin(Math.PI * time),
      0.08 + 0.02 * time,
      0,
    ])
    sampler.getInput()?.setArray(new Float32Array(times))
    sampler.getOutput()?.setArray(new Float32Array(values))
    const io = await createModelIO()
    const inputPath = path.join(dir, 'raw.glb')
    const outputPath = path.join(dir, 'model.glb')
    await io.write(inputPath, doc)
    const before = readProductPreservation(await io.read(inputPath))
    let checkedBytes: Buffer | undefined
    await runOptimizePipeline({
      inputPath,
      outputPath,
      settings: DEFAULT_OPTIMIZE_SETTINGS,
      io,
      runKtx: async () => undefined,
      run: runFixtureGltfCli,
      validateCandidate: async (candidate) => {
        const after = readProductPreservation(await io.read(candidate))
        const losses = findPreservationLosses(before, after)
        if (losses.length > 0) throw new Error(losses.join(', '))
        checkedBytes = await readFile(candidate)
      },
    })
    const after = readProductPreservation(await io.read(outputPath))
    const track = after.semantics.tracks[0]
    if (track === undefined) throw new Error('missing candidate track')
    return {
      before,
      after,
      track,
      times,
      checkedBytes,
      publishedBytes: await readFile(outputPath),
      files: (await readdir(dir)).sort(),
    }
  })
}

let fixture: Awaited<ReturnType<typeof resampledFixture>>
beforeAll(async () => {
  fixture = await resampledFixture()
}, SUBPROCESS_FIXTURE_TIMEOUT_MS)

it('accepts a dense baked motion thinned by the real resampler within the shared budget', () => {
  const { before, after, track, times, checkedBytes, publishedBytes, files } = fixture
  expect(track.times.length).toBeLessThan(times.length)
  expect(findPreservationLosses(before, after)).toEqual([])
  expect(publishedBytes).toEqual(checkedBytes)
  expect(files).toEqual(['model.glb', 'raw.glb'])

  const key = before.semantics.tracks[0]?.values.slice(0, 3) ?? []
  const budget = ANIMATION_RESAMPLE_TOLERANCE + translationKeyComponentBound(key)
  const changedValues = [...track.values]
  changedValues[0] = (key[0] ?? 0) + 2 * budget
  track.values = changedValues
  expect(findPreservationLosses(before, after)).toContain(
    'animation channel changed: ["Explode","PART_body","translation"]',
  )
})
