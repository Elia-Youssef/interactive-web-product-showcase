// The optimize step: turns a product's raw Blender export into the file the
// site loads.
//
//   assets/blender/<slug>/export/<slug>.glb -> public/models/<slug>/model.glb
//
// Usage:
//   pnpm assets:optimize            optimize every product with an export
//   pnpm assets:optimize <slug>     optimize one product
//
// KTX-Software is resolved and verified once per run: the environment
// variable KTX_SOFTWARE_BIN first, then the process PATH, then the platform
// default install folder. The encode stage spawns ktx by absolute path
// from the resolved folder.
import { fileURLToPath } from 'node:url'
import { GltfCliError, resolveGltfCliBin, runGltfCli } from './gltfCli.ts'
import { MODEL_BUDGET_BYTES } from './budgets.ts'
import { listExportedSlugs } from './exports.ts'
import {
  KtxError,
  ktxExecutablePath,
  prepareKtxSoftware,
  runKtxCommand,
  type KtxResolution,
} from './ktxSoftware.ts'
import { createModelIO } from './modelIo.ts'
import { runOptimizePipeline } from './pipeline.ts'
import {
  budgetShare,
  fileSizeBytes,
  formatBytes,
  formatKtxResolutionLine,
  formatTangentLine,
  formatTextureLine,
  type TextureReport,
} from './report.ts'
import { productPaths, type ProductPaths } from './productPaths.ts'
import { loadOptimizeSettings, type OptimizeSettings } from './settings.ts'
import type { TangentReport } from './tangents.ts'
import {
  findSingleAnimationViolations,
  findStructureLosses,
  readProductStructure,
} from './structure.ts'

// The repo root: the parent of the scripts folder this file lives in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

function writeLine(text: string): void {
  process.stdout.write(`${text}\n`)
}

function writeError(text: string): void {
  process.stderr.write(`${text}\n`)
}

async function resolveSlugs(argv: readonly string[]): Promise<string[]> {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--all')) {
    return listExportedSlugs(ROOT)
  }
  if (argv.length === 1) {
    const slug = argv[0] ?? ''
    const exportGlb = productPaths(ROOT, slug).exportGlb
    if ((await fileSizeBytes(exportGlb)) === null) {
      throw new Error(`No export found for '${slug}': expected ${exportGlb}`)
    }
    return [slug]
  }
  throw new Error(`Usage: pnpm assets:optimize [slug] (got ${argv.length} arguments)`)
}

// Optimizes one product and prints its report. The settings come from the
// optional per-product override file; the structure facts are read back
// from the written file, never assumed, and the texture lines are the
// run's own, each drawn from the plan entry that encoded it.
async function optimizeProduct(
  paths: ProductPaths,
  settings: OptimizeSettings,
  ktxResolution: KtxResolution,
): Promise<void> {
  const io = await createModelIO()
  const beforeStructure = readProductStructure(await io.read(paths.exportGlb))
  const inputBytes = await fileSizeBytes(paths.exportGlb)
  const run = await runOptimizePipeline({
    inputPath: paths.exportGlb,
    outputPath: paths.modelGlb,
    settings,
    io,
    runKtx: (args) =>
      runKtxCommand(ktxExecutablePath(ktxResolution.folder, process.platform), args),
    run: (args) => runGltfCli(resolveGltfCliBin(), args, process.env),
  })
  const outputDoc = await io.read(paths.modelGlb)
  const outputBytes = await fileSizeBytes(paths.modelGlb)
  if (outputBytes === null || inputBytes === null) {
    throw new Error(`Missing file after optimizing '${paths.slug}'`)
  }
  printRunReport(paths, settings, inputBytes, outputBytes, run.textures, run.tangents)
  const afterStructure = readProductStructure(outputDoc)
  printStructure(afterStructure)
  const losses = [
    ...findStructureLosses(beforeStructure, afterStructure),
    ...findSingleAnimationViolations(afterStructure),
  ]
  if (losses.length > 0) {
    const lines = losses.map((loss) => `- ${loss}`).join('\n')
    throw new Error(`Optimized '${paths.slug}' lost required structure:\n${lines}`)
  }
}

function printRunReport(
  paths: ProductPaths,
  settings: OptimizeSettings,
  inputBytes: number,
  outputBytes: number,
  textures: readonly TextureReport[],
  tangents: TangentReport,
): void {
  writeLine(`product: ${paths.slug}`)
  writeLine(`  input:  ${paths.exportGlb} (${formatBytes(inputBytes)})`)
  writeLine(`  output: ${paths.modelGlb} (${formatBytes(outputBytes)})`)
  writeLine(
    `  budget: ${formatBytes(MODEL_BUDGET_BYTES)} per product, used ${budgetShare(outputBytes)}`,
  )
  writeLine(
    `  settings: textureMaxSize ${settings.textureMaxSize}, ` +
      `occlusionTextureMaxSize ${settings.occlusionTextureMaxSize}`,
  )
  writeLine(`  ${formatTangentLine(tangents)}`)
  writeLine('  textures:')
  for (const texture of textures) {
    writeLine(`    ${formatTextureLine(texture, settings)}`)
  }
}

function printStructure(structure: ReturnType<typeof readProductStructure>): void {
  writeLine(`  structure: ${structure.nodeNames.length} named nodes`)
  for (const anchor of structure.hotspotAnchors) {
    writeLine(`    hotspot ${anchor.name} under ${anchor.parentName ?? 'scene root'}`)
  }
  writeLine(`  cameras: ${structure.cameraNames.join(', ') || 'none'}`)
  writeLine(
    `  variants: ${structure.variantNames.join(', ') || 'none'} (${structure.mappingCount} mappings)`,
  )
  writeLine(`  animations: ${structure.animationNames.join(', ') || 'none'}`)
  writeLine(`  meshopt compression: ${structure.meshoptCompressed ? 'on' : 'off'}`)
  writeLine(`  unlit materials: ${structure.unlitMaterialNames.join(', ') || 'none'}`)
  writeLine(`  occlusion maps on: ${structure.occlusionMaterialNames.join(', ') || 'none'}`)
}

export async function main(argv: readonly string[]): Promise<void> {
  const slugs = await resolveSlugs(argv)
  const resolution = await prepareKtxSoftware()
  writeLine(formatKtxResolutionLine(resolution))
  for (const slug of slugs) {
    const paths = productPaths(ROOT, slug)
    const { settings, usedOverride } = await loadOptimizeSettings(paths.settingsFile)
    if (usedOverride) {
      writeLine(`settings: override ${paths.settingsFile}`)
    }
    await optimizeProduct(paths, settings, resolution)
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  writeError(error instanceof Error ? error.message : String(error))
  if (error instanceof GltfCliError || error instanceof KtxError) {
    writeError('(see the header of scripts/optimize.ts for the pipeline requirements)')
  }
  process.exitCode = 1
})
