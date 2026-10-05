// The optimize pipeline: the in-process stages over the Document (the
// tangent drop and the KTX2 texture encode plan) plus the
// structure-preserving geometry pass through the gltf-transform CLI.
//
// The texture work is one encode plan over the Document (see ktx2Plan.ts):
// a pure value that says, per texture, the stage that claims it, the mode,
// the size, the color space and the full ktx create arguments. The plan is
// executed in a bounded pool of single-threaded ktx processes (see
// ktx2Encode.ts). The plan exists so the stage order, the stage set and
// the per-texture facts are one tested value: the CLI's own optimize ktx2
// path has a single global --texture-size and always spawns ktx with at
// least two threads, which is not byte-stable. The tangent stage runs
// before the plan is built: it strips attributes only, so the texture
// positions the plan keys on are unaffected. The geometry pass then runs
// `optimize` with the structure flags and --texture-compress=false: the
// plan already encoded every texture, so the geometry stage needs no
// KTX-Software at all.
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Document } from '@gltf-transform/core'
import { executeEncodePlan, type Ktx2Runner } from './ktx2Encode.ts'
import { buildEncodePlan, type EncodePlan } from './ktx2Plan.ts'
import { describeTextures, type TextureReport } from './report.ts'
import type { OptimizeSettings } from './settings.ts'
import { dropUnusedTangents, type TangentReport } from './tangents.ts'

// The runner the geometry stage is parameterized by: one gltf-transform
// command. The real runner spawns the CLI; tests record the calls instead.
export type CliRunner = (args: readonly string[]) => Promise<unknown>

export function buildGeometryStageArgs(
  inputPath: string,
  outputPath: string,
  settings: OptimizeSettings,
): string[] {
  return [
    'optimize',
    inputPath,
    outputPath,
    `--flatten=${settings.flatten}`,
    `--join=${settings.join}`,
    `--simplify=${settings.simplify}`,
    `--palette=${settings.palette}`,
    `--prune=${settings.prune}`,
    '--texture-compress=false',
    `--compress=${settings.compress}`,
  ]
}

// Reading and writing one product Document. The NodeIO of modelIo.ts
// satisfies this against files; tests use in-memory documents.
export type ModelDocumentIO = {
  read(path: string): Promise<Document>
  write(path: string, doc: Document): Promise<void>
}

export type PipelineParams = {
  inputPath: string
  outputPath: string
  settings: OptimizeSettings
  io: ModelDocumentIO
  runKtx: Ktx2Runner
  run: CliRunner
}

// The outcome of one pipeline run: the tangent report and the encode plan
// it executed, and the report of every texture as the encode left it. The
// report is described from the document the plan was built over, the one
// document whose texture positions key the plan's entries, so each texture
// meets its own entry; the written file is not described here, because its
// geometry pass merges identical textures and shifts the positions after
// them.
export type PipelineRun = {
  plan: EncodePlan
  textures: readonly TextureReport[]
  tangents: TangentReport
}

// Runs the full pipeline on one product and returns the tangent report and
// the encode plan it executed with the texture report drawn from it, so
// the run report and the tests print and assert from the same values the
// stages ran. The stages run on one in-memory Document, written through a
// temporary folder, then the geometry pass runs straight to the output
// path, creating its folder. The temporary folder is removed even when a
// stage fails.
export async function runOptimizePipeline(params: PipelineParams): Promise<PipelineRun> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'optimize-'))
  try {
    const doc = await params.io.read(params.inputPath)
    const tangents = dropUnusedTangents(doc)
    const plan = buildEncodePlan(doc, params.settings)
    await executeEncodePlan({
      doc,
      plan,
      workspaceDir: tempDir,
      jobs: params.settings.ktxJobs,
      runKtx: params.runKtx,
    })
    const textures = describeTextures(doc, plan)
    const afterTextures = path.join(tempDir, 'stage-textures-ktx2.glb')
    await params.io.write(afterTextures, doc)
    await mkdir(path.dirname(params.outputPath), { recursive: true })
    await params.run(buildGeometryStageArgs(afterTextures, params.outputPath, params.settings))
    return { plan, textures, tangents }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
