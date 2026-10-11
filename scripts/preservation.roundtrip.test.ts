import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { runFixtureGltfCli } from './gltfCli.fixtures.ts'
import { createModelIO } from './modelIo.ts'
import { withTempDir, writeOptimizedModel } from './optimizedModel.fixtures.ts'
import { runOptimizePipeline } from './pipeline.ts'
import { namedNode, preservationFixture } from './preservation.fixtures.ts'
import { productPaths } from './productPaths.ts'
import { loadOptimizeSettings } from './settings.ts'
import { listShippedSlugs } from './shippedProducts.ts'
import { findPreservationLosses, readProductPreservation } from './preservationCompare.ts'

const root = path.resolve(import.meta.dirname, '..')
const slugs = await listShippedSlugs(root)

describe('authored storage round trips', () => {
  describe.each(slugs)('the %s storage codec', (slug) => {
    let losses: string[]
    beforeAll(async () => {
      losses = await withTempDir(async (dir) => {
        const paths = productPaths(root, slug)
        const inputPath = path.join(dir, 'source.glb')
        const outputPath = path.join(dir, 'candidate.glb')
        await copyFile(paths.modelGlb, inputPath)
        const io = await createModelIO()
        const doc = await io.read(inputPath)
        const before = readProductPreservation(doc)
        await writeOptimizedModel(doc, outputPath)
        return findPreservationLosses(before, readProductPreservation(await io.read(outputPath)))
      })
    }, TOOL_FIXTURE_TIMEOUT_MS)
    it(`keeps decoded semantics of a copied ${slug} model through the storage codec`, () => {
      expect(losses).toEqual([])
    })
  })

  describe.each(slugs)('the %s pipeline settings', (slug) => {
    async function publishedFixture() {
      return withTempDir(async (dir) => {
        const inputPath = path.join(dir, 'raw.glb')
        const outputPath = path.join(dir, 'model.glb')
        const io = await createModelIO()
        await io.write(inputPath, preservationFixture())
        const before = readProductPreservation(await io.read(inputPath))
        const { settings } = await loadOptimizeSettings(productPaths(root, slug).settingsFile)
        let checked: Buffer | undefined
        let validated: Awaited<ReturnType<typeof io.read>> | undefined
        await runOptimizePipeline({
          inputPath,
          outputPath,
          settings,
          io,
          runKtx: async () => {
            throw new Error('a geometry fixture has no texture encodes')
          },
          run: runFixtureGltfCli,
          validateCandidate: async (candidatePath) => {
            const candidate = await io.read(candidatePath)
            const after = readProductPreservation(candidate)
            const losses = findPreservationLosses(before, after)
            if (losses.length > 0) throw new Error(losses.join(', '))
            validated = candidate
            checked = await readFile(candidatePath)
          },
        })
        if (validated === undefined) throw new Error('the candidate was not validated')
        return {
          before,
          candidate: validated,
          checked,
          published: await readFile(outputPath),
          files: (await readdir(dir)).sort(),
        }
      })
    }

    let fixture: Awaited<ReturnType<typeof publishedFixture>>
    beforeAll(async () => {
      fixture = await publishedFixture()
    }, TOOL_FIXTURE_TIMEOUT_MS)

    it(`publishes the validated candidate at the ${slug} pipeline settings`, () => {
      const { before, candidate, checked, published, files } = fixture
      const after = readProductPreservation(candidate)
      expect(findPreservationLosses(before, after)).toEqual([])
      expect(
        candidate
          .getRoot()
          .listNodes()
          .some((node) => node.getName() === '' && node.getMesh() !== null),
      ).toBe(true)
      expect(
        candidate
          .getRoot()
          .listMeshes()[0]
          ?.listPrimitives()[0]
          ?.getAttribute('POSITION')
          ?.getNormalized(),
      ).toBe(true)
      expect(after.semantics.tracks[0]?.values).not.toEqual(before.semantics.tracks[0]?.values)
      expect(after.semantics.tracks[0]?.times.length ?? 0).toBeLessThan(
        before.semantics.tracks[0]?.times.length ?? 0,
      )
      expect(published).toEqual(checked)
      expect(files).toEqual(['model.glb', 'raw.glb'])
    })
  })

  describe(
    'artifact mutation through the model reader',
    { timeout: TOOL_FIXTURE_TIMEOUT_MS },
    () => {
      it('rejects an installed semantic mutation while preserving previous bytes', async () => {
        await withTempDir(async (dir) => {
          const io = await createModelIO()
          const inputPath = path.join(dir, 'raw.glb')
          const outputPath = path.join(dir, 'model.glb')
          await io.write(inputPath, preservationFixture())
          await writeFile(outputPath, 'previous artifact')
          const previous = await readFile(outputPath)
          const before = readProductPreservation(await io.read(inputPath))
          const { settings } = await loadOptimizeSettings(path.join(dir, 'absent.json'))
          let losses: string[] = []
          await expect(
            runOptimizePipeline({
              inputPath,
              outputPath,
              settings,
              io,
              runKtx: async () => undefined,
              run: async (args) => {
                await copyFile(args[1] ?? '', args[2] ?? '')
                const changed = await io.read(args[2] ?? '')
                namedNode(changed, 'HS_detail').setTranslation([10, 0, 0])
                await io.write(args[2] ?? '', changed)
              },
              validateCandidate: async (candidate) => {
                losses = findPreservationLosses(
                  before,
                  readProductPreservation(await io.read(candidate)),
                )
                if (losses.length > 0) throw new Error(losses.join(', '))
              },
            }),
          ).rejects.toThrow('world rest changed: HS_detail')
          expect(losses).toContain('world rest changed: HS_detail')
          expect(await readFile(outputPath)).toEqual(previous)
          expect((await readdir(dir)).sort()).toEqual(['model.glb', 'raw.glb'])
        })
      })
    },
  )
})
