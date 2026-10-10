import * as fsPromises from 'node:fs/promises'
import path from 'node:path'
import { Document } from '@gltf-transform/core'
import { describe, expect, it, vi } from 'vitest'
import { withTempDir } from './optimizedModel.fixtures.ts'
import { runOptimizePipeline } from './pipeline.ts'
import { DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'

const state = vi.hoisted((): { failStep: 'cleanup' | 'rename' | undefined; events: string[] } => ({
  failStep: undefined,
  events: [],
}))

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof fsPromises>('node:fs/promises')
  return {
    ...actual,
    rm: async (...args: Parameters<typeof fsPromises.rm>) => {
      if (path.basename(String(args[0])).startsWith('optimize-')) {
        state.events.push('cleanup')
        if (state.failStep === 'cleanup') {
          state.failStep = undefined
          throw new Error('workspace cleanup failure')
        }
      }
      return actual.rm(...args)
    },
    rename: async (...args: Parameters<typeof fsPromises.rename>) => {
      state.events.push('publish')
      if (state.failStep === 'rename') {
        state.failStep = undefined
        throw new Error('rename failure')
      }
      return actual.rename(...args)
    },
  }
})

describe('publication is the final fallible operation', () => {
  it.each(['cleanup', 'rename', 'success'] as const)(
    'handles %s without publishing failed work',
    async (step) => {
      state.events = []
      await withTempDir(async (dir) => {
        const outputPath = path.join(dir, 'model.glb')
        await fsPromises.writeFile(outputPath, 'previous artifact')
        const run = runOptimizePipeline({
          inputPath: 'raw.glb',
          outputPath,
          settings: DEFAULT_OPTIMIZE_SETTINGS,
          io: { read: async () => new Document(), write: async () => undefined },
          runKtx: async () => undefined,
          run: async (args) => {
            await fsPromises.writeFile(args[2] ?? '', 'candidate artifact')
          },
          validateCandidate: async () => {
            state.failStep = step === 'success' ? undefined : step
          },
        })
        if (step === 'success') {
          await run
          expect(await fsPromises.readFile(outputPath, 'utf8')).toBe('candidate artifact')
          expect(state.events).toEqual(['cleanup', 'publish'])
        } else {
          await expect(run).rejects.toThrow(
            step === 'cleanup' ? 'workspace cleanup failure' : 'rename failure',
          )
          expect(await fsPromises.readFile(outputPath, 'utf8')).toBe('previous artifact')
        }
        expect(await fsPromises.readdir(dir)).toEqual(['model.glb'])
      })
    },
  )
})
