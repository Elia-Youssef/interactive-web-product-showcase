import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Document } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { withTempDir } from './optimizedModel.fixtures.ts'
import { createModelIO } from './modelIo.ts'
import { runOptimizePipeline } from './pipeline.ts'
import { DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'
import { findStructureLosses, readProductStructure } from './structure.ts'

describe('optimized artifact publication', () => {
  describe('model failures before publication', { timeout: TOOL_FIXTURE_TIMEOUT_MS }, () => {
    it.each(['CLI', 'read', 'check'])(
      'preserves previous bytes after a %s failure',
      async (step) => {
        await withTempDir(async (dir) => {
          const outputPath = path.join(dir, 'model.glb')
          const previous = Buffer.from('previous artifact')
          await writeFile(outputPath, previous)
          const doc = new Document()
          doc.createScene().addChild(doc.createNode('PART_body'))
          const io = await createModelIO()
          const inputPath = path.join(dir, 'raw.glb')
          await io.write(inputPath, doc)
          const before = readProductStructure(doc)
          const validateCandidate = async (candidate: string) => {
            const after = readProductStructure(await io.read(candidate))
            const losses = findStructureLosses(before, after)
            if (losses.length > 0) throw new Error(`check failure: ${losses.join(', ')}`)
          }
          await expect(
            runOptimizePipeline({
              inputPath,
              outputPath,
              settings: DEFAULT_OPTIMIZE_SETTINGS,
              io,
              runKtx: async () => undefined,
              run: async (args) => {
                const candidate = args[2] ?? ''
                if (step === 'check') {
                  const changed = new Document()
                  changed.createScene()
                  await io.write(candidate, changed)
                } else {
                  await writeFile(candidate, 'partial invalid GLB')
                }
                if (step === 'CLI') throw new Error('CLI failure')
              },
              validateCandidate,
            }),
          ).rejects.toThrow(step === 'read' ? /not valid JSON/ : `${step} failure`)
          expect(await readFile(outputPath)).toEqual(previous)
          expect((await readdir(dir)).sort()).toEqual(['model.glb', 'raw.glb'])
        })
      },
    )
  })

  it('publishes exactly the checked bytes on the destination filesystem', async () => {
    await withTempDir(async (dir) => {
      const outputPath = path.join(dir, 'model.glb')
      await writeFile(outputPath, 'previous artifact')
      const bytes = Buffer.from('validated candidate artifact')
      let checked: Buffer | undefined
      const doc = new Document()
      await runOptimizePipeline({
        inputPath: 'raw.glb',
        outputPath,
        settings: DEFAULT_OPTIMIZE_SETTINGS,
        io: { read: async () => doc, write: async () => undefined },
        runKtx: async () => undefined,
        run: async (args) => {
          await writeFile(args[2] ?? '', bytes)
        },
        validateCandidate: async (candidate) => {
          expect(path.dirname(candidate)).toBe(dir)
          expect(candidate).not.toBe(outputPath)
          expect(await readFile(outputPath)).toEqual(Buffer.from('previous artifact'))
          checked = await readFile(candidate)
        },
      })
      expect(checked).toEqual(bytes)
      expect(await readFile(outputPath)).toEqual(checked)
      expect(await readdir(dir)).toEqual(['model.glb'])
    })
  })
})
