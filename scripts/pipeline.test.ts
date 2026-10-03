import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_TABLE } from './encodePlan.fixtures.ts'
import type { ModelDocumentIO } from './pipeline.ts'
import { buildGeometryStageArgs, runOptimizePipeline } from './pipeline.ts'
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from './settings.ts'
import {
  docWithTextures,
  KTX2_PLACEHOLDER,
  recordedCliRunner,
  recordedKtxRunner,
  textureByName,
} from './texture.fixtures.ts'

const settingsWith = (overrides: Partial<OptimizeSettings>): OptimizeSettings => ({
  ...DEFAULT_OPTIMIZE_SETTINGS,
  ...overrides,
})

describe('buildGeometryStageArgs', () => {
  it('carries the structure flags with texture work already done', () => {
    expect(buildGeometryStageArgs('in.glb', 'out.glb', DEFAULT_OPTIMIZE_SETTINGS)).toEqual([
      'optimize',
      'in.glb',
      'out.glb',
      '--flatten=false',
      '--join=false',
      '--simplify=false',
      '--palette=false',
      '--prune=false',
      '--texture-compress=false',
      '--compress=meshopt',
    ])
  })

  it('reflects a setting that turns pruning on', () => {
    const args = buildGeometryStageArgs('in.glb', 'out.glb', settingsWith({ prune: true }))
    expect(args).toContain('--prune=true')
  })
})

describe('runOptimizePipeline: the encode plan of one texture per class', () => {
  it('plans and encodes every texture class exactly as tabulated', async () => {
    const doc = docWithTextures(PLAN_TABLE.map((row) => row.def))
    const written: string[] = []
    const io: ModelDocumentIO = {
      read: async () => doc,
      write: async (filePath, writtenDoc) => {
        expect(writtenDoc).toBe(doc)
        written.push(filePath)
      },
    }
    const ktx = recordedKtxRunner()
    const cli = recordedCliRunner()
    const outputDir = await mkdtemp(path.join(tmpdir(), 'pipeline-test-'))
    const outputPath = path.join(outputDir, 'nested', 'model.glb')
    const { plan, textures } = await runOptimizePipeline({
      inputPath: 'raw.glb',
      outputPath,
      settings: settingsWith({ occlusionTextureMaxSize: 512 }),
      io,
      runKtx: ktx.runKtx,
      run: cli.run,
    })
    // The plan is the pure value the pipeline executed: one exact entry per
    // texture class, and every ktx call is one of the planned encodes with
    // the file names resolved against the workspace.
    expect(plan.entries).toHaveLength(PLAN_TABLE.length)
    for (const row of PLAN_TABLE) {
      const entry = plan.entries.find(
        (candidate) => candidate.textureIndex === row.entry.textureIndex,
      )
      expect(entry, row.name).toEqual(row.entry)
    }
    // The run's texture report is drawn from the same plan: each texture
    // meets its own entry, and names the slots the encoder read, extension
    // slots included.
    expect(textures).toHaveLength(PLAN_TABLE.length)
    for (const row of PLAN_TABLE) {
      const report = textures[row.entry.textureIndex]
      expect(
        {
          label: report?.label,
          slots: report?.slots,
          stage: report?.stage,
          sizeRule: report?.sizeRule,
        },
        row.name,
      ).toEqual({
        label: row.def.name,
        slots: row.entry.slots,
        stage: row.entry.stage,
        sizeRule: row.entry.sizeRule,
      })
    }
    expect(ktx.calls).toHaveLength(PLAN_TABLE.length)
    for (const row of PLAN_TABLE) {
      // The pool starts the encodes in order but they settle concurrently,
      // so each call is matched by its unique target file, not by order.
      const call = ktx.calls.find(
        (candidate) =>
          path.basename(candidate[candidate.length - 1] ?? '') === row.entry.targetName,
      )
      expect(call, row.name).toEqual([
        ...row.entry.arguments.slice(0, -2),
        expect.stringContaining(row.entry.sourceName),
        expect.stringContaining(row.entry.targetName),
      ])
    }
    // Every texture left the run as KTX2, and the geometry pass ran once.
    for (const row of PLAN_TABLE) {
      expect(textureByName(doc, row.def.name)?.getMimeType()).toBe('image/ktx2')
      expect(textureByName(doc, row.def.name)?.getImage()).toEqual(Buffer.from(KTX2_PLACEHOLDER))
    }
    expect(written).toHaveLength(1)
    expect(written[0]).toMatch(/stage-textures-ktx2\.glb$/)
    expect(cli.calls).toHaveLength(1)
    const geometry = cli.calls[0] ?? []
    expect(geometry[0]).toBe('optimize')
    expect(geometry[1]).toBe(written[0])
    expect(geometry[2]).toBe(outputPath)
    expect(geometry).toContain('--texture-compress=false')
    expect(geometry).toContain('--compress=meshopt')
  })
})
