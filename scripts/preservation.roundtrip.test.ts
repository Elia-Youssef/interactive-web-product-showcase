import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveGltfCliBin, runGltfCli } from './gltfCli.ts'
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
  it.each(slugs)(
    'keeps decoded semantics of a copied %s model through the storage codec',
    async (slug) => {
      await withTempDir(async (dir) => {
        const paths = productPaths(root, slug)
        const inputPath = path.join(dir, 'source.glb')
        const outputPath = path.join(dir, 'candidate.glb')
        await copyFile(paths.modelGlb, inputPath)
        const io = await createModelIO()
        const doc = await io.read(inputPath)
        const before = readProductPreservation(doc)
        await writeOptimizedModel(doc, outputPath)
        expect(
          findPreservationLosses(before, readProductPreservation(await io.read(outputPath))),
        ).toEqual([])
      })
    },
  )

  it.each(slugs)('publishes the validated candidate at the %s pipeline settings', async (slug) => {
    await withTempDir(async (dir) => {
      const inputPath = path.join(dir, 'raw.glb')
      const outputPath = path.join(dir, 'model.glb')
      const io = await createModelIO()
      await io.write(inputPath, preservationFixture())
      const before = readProductPreservation(await io.read(inputPath))
      const { settings } = await loadOptimizeSettings(productPaths(root, slug).settingsFile)
      let checked: Buffer | undefined
      await runOptimizePipeline({
        inputPath,
        outputPath,
        settings,
        io,
        runKtx: async () => {
          throw new Error('a geometry fixture has no texture encodes')
        },
        run: (args) => runGltfCli(resolveGltfCliBin(), args, process.env),
        validateCandidate: async (candidatePath) => {
          const candidate = await io.read(candidatePath)
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
          checked = await readFile(candidatePath)
        },
      })
      expect(await readFile(outputPath)).toEqual(checked)
      expect((await readdir(dir)).sort()).toEqual(['model.glb', 'raw.glb'])
    })
  })

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
})
