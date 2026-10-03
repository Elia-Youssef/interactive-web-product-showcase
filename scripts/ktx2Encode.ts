// Executes a per-document KTX2 encode plan (ktx2Plan.ts): one ktx create
// per plan entry, run in a bounded pool of single-threaded ktx processes
// from the resolved KTX-Software install, and the encoded images written
// back into the document.
//
// Each entry's output depends only on its own input: the encoder runs with
// one thread and the entries touch disjoint files, so the pool size cannot
// change any byte. The write-back reproduces the CLI's toktx function
// (dist/cli.mjs 680-681): the encoded image replaces the source with the
// KTX2 mime type, and a texture that had a URI gets the same basename with
// the .ktx2 extension.
import { FileUtils, type Document, type Texture } from '@gltf-transform/core'
import { KHRTextureBasisu } from '@gltf-transform/extensions'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { EncodePlan, EncodePlanEntry } from './ktx2Plan.ts'

// One ktx command, spawned from the resolved install. The real runner is
// runKtxCommand from ktxSoftware.ts; tests record the calls instead.
export type Ktx2Runner = (args: readonly string[]) => Promise<unknown>

export type ExecutePlanParams = {
  doc: Document
  plan: EncodePlan
  // The folder the plan's file names are relative to; the pool's tasks
  // write each source image there and read the encoded result back.
  workspaceDir: string
  // The maximum number of ktx processes in flight, from the settings.
  jobs: number
  runKtx: Ktx2Runner
}

// The arguments of one entry with the two file names resolved against the
// workspace: the builder always appends them last, so the executor can
// turn the planned command into the spawned one.
function resolvedArguments(entry: EncodePlanEntry, workspaceDir: string): string[] {
  const args = [...entry.arguments.slice(0, -2)]
  const sourceName = entry.arguments[entry.arguments.length - 2]
  const targetName = entry.arguments[entry.arguments.length - 1]
  if (sourceName === undefined || targetName === undefined || sourceName !== entry.sourceName) {
    throw new Error(`ktx2: ${entry.label}: plan arguments do not end with the planned file names`)
  }
  args.push(path.join(workspaceDir, sourceName), path.join(workspaceDir, targetName))
  return args
}

// Encodes one texture of the plan and writes the result back in place.
async function encodeEntry(
  entry: EncodePlanEntry,
  texture: Texture,
  params: ExecutePlanParams,
): Promise<void> {
  const sourcePath = path.join(params.workspaceDir, entry.sourceName)
  const targetPath = path.join(params.workspaceDir, entry.targetName)
  const srcImage = texture.getImage()
  if (srcImage === null) {
    throw new Error(`ktx2: ${entry.label}: texture is unreadable and cannot be encoded`)
  }
  await writeFile(sourcePath, srcImage)
  await params.runKtx(resolvedArguments(entry, params.workspaceDir))
  texture.setImage(await readFile(targetPath)).setMimeType('image/ktx2')
  if (texture.getURI()) {
    texture.setURI(FileUtils.basename(texture.getURI()) + '.ktx2')
  }
}

// Runs the tasks with at most `limit` in flight, started in order. Every
// task settles before the first failure (lowest task index first) is
// rethrown, so a failure never leaves an unobserved rejection behind.
async function runBounded(tasks: readonly (() => Promise<void>)[], limit: number): Promise<void> {
  const failures: { index: number; error: unknown }[] = []
  let next = 0
  const workerCount = Math.max(1, Math.min(limit, tasks.length))
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < tasks.length) {
      const index = next
      next += 1
      const task = tasks[index]
      if (task === undefined) {
        throw new Error('ktx2: task pool index out of range')
      }
      try {
        await task()
      } catch (error: unknown) {
        failures.push({ index, error })
      }
    }
  })
  await Promise.all(workers)
  failures.sort((left, right) => left.index - right.index)
  const first = failures[0]
  if (first !== undefined) {
    throw first.error
  }
}

// Executes the plan on the document. The KHR_texture_basisu extension is
// required from the start and disposed when nothing in the document is
// KTX2 afterwards, as the CLI's stages did (cli.mjs 614, 692);
// createExtension reuses the document's instance if one exists.
export async function executeEncodePlan(params: ExecutePlanParams): Promise<void> {
  const basisu = params.doc.createExtension(KHRTextureBasisu).setRequired(true)
  const textures = params.doc.getRoot().listTextures()
  const tasks = params.plan.entries.map((entry) => async () => {
    const texture = textures[entry.textureIndex]
    if (texture === undefined) {
      throw new Error(`ktx2: ${entry.label}: texture ${entry.textureIndex} is missing`)
    }
    await encodeEntry(entry, texture, params)
  })
  await runBounded(tasks, params.jobs)
  if (
    !params.doc
      .getRoot()
      .listTextures()
      .some((texture) => texture.getMimeType() === 'image/ktx2')
  ) {
    basisu.dispose()
  }
}
