import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { resolveGltfCliBin, runGltfCli } from './gltfCli.ts'
import { createModelIO } from './modelIo.ts'
import { withTempDir } from './optimizedModel.fixtures.ts'
import { buildGeometryStageArgs } from './pipeline.ts'
import { geometryTransforms } from './geometryOptimize.ts'
import { namedNode, preservationFixture } from './preservation.fixtures.ts'
import { ANIMATION_RESAMPLE_TOLERANCE, DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'

const config = fileURLToPath(new URL('./geometryCli.config.ts', import.meta.url))

function curvedFixture() {
  const doc = preservationFixture()
  namedNode(doc, 'PART_body').setTranslation([0, 0.08, 0])
  const sampler = doc.getRoot().listAnimations()[0]?.listSamplers()[0]
  if (sampler === undefined) throw new Error('missing fixture sampler')
  sampler.getInput()?.setArray(new Float32Array([0, 0.5, 1]))
  sampler
    .getOutput()
    ?.setArray(
      new Float32Array([0, 0.08, 0, ANIMATION_RESAMPLE_TOLERANCE * 0.8, 0.08, 0, 0, 0.08, 0]),
    )
  return doc
}

it('uses the supplied tolerance in the real resampler', async () => {
  const strict = curvedFixture()
  const tolerant = curvedFixture()
  await strict.transform(
    ...geometryTransforms({ ...DEFAULT_OPTIMIZE_SETTINGS, resampleTolerance: 0 }),
  )
  await tolerant.transform(...geometryTransforms(DEFAULT_OPTIMIZE_SETTINGS))
  const count = (doc: typeof strict) =>
    doc.getRoot().listAnimations()[0]?.listSamplers()[0]?.getInput()?.getCount()
  expect(count(strict)).toBe(3)
  expect(count(tolerant)).toBe(2)
})

it('passes the shared resampling tolerance explicitly to the geometry command', () => {
  const args = buildGeometryStageArgs('source.glb', 'candidate.glb', DEFAULT_OPTIMIZE_SETTINGS)
  expect(args).toContain(`--resample-tolerance=${ANIMATION_RESAMPLE_TOLERANCE}`)
  expect(args).toContain(config)
})

it('writes identical bytes to the stock optimize command with its existing defaults', async () => {
  await withTempDir(async (dir) => {
    const io = await createModelIO()
    const source = path.join(dir, 'raw.glb')
    const stock = path.join(dir, 'stock.glb')
    const explicit = path.join(dir, 'explicit.glb')
    await io.write(source, curvedFixture())
    const bin = resolveGltfCliBin()
    await runGltfCli(
      bin,
      [
        'optimize',
        source,
        stock,
        '--flatten=false',
        '--join=false',
        '--simplify=false',
        '--palette=false',
        '--prune=false',
        '--texture-compress=false',
        '--compress=meshopt',
      ],
      process.env,
    )
    await runGltfCli(
      bin,
      [
        'optimize-preserving',
        source,
        explicit,
        '--config',
        config,
        `--resample-tolerance=${ANIMATION_RESAMPLE_TOLERANCE}`,
      ],
      process.env,
    )
    expect(await readFile(explicit)).toEqual(await readFile(stock))
  })
})
