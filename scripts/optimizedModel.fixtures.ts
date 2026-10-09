// A fixture document written the way the optimize step's geometry stage
// writes a product: the meshopt transform the gltf-transform CLI runs
// (reorder, quantize at the given settings, the per-target filters), then
// a real .glb through the encoder. The storage suites read these files
// back through the same readers the validate step runs, so a storage fact
// is proven on written bytes, not on a declaration.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Logger, NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt, type MeshoptOptions } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

export type OptimizeOverrides = Omit<MeshoptOptions, 'encoder'>

// Writes the document as an optimized model at the given path. The
// overrides bend the transform's own defaults, which is how a suite plants
// a file stored at other settings than the pipeline's.
export async function writeOptimizedModel(
  doc: Document,
  file: string,
  overrides: OptimizeOverrides = {},
): Promise<void> {
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  // The transform logs what it prunes; a suite reads the written file.
  doc.setLogger(new Logger(Logger.Verbosity.SILENT))
  await doc.transform(meshopt({ encoder: MeshoptEncoder, ...overrides }))
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  })
  await io.write(file, doc)
}

// Runs the body with a fresh temporary folder and removes the folder after,
// whether the body passes or throws.
export async function withTempDir<T>(body: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'optimized-model-'))
  try {
    return await body(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
