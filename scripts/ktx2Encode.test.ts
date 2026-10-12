import { KHRTextureBasisu } from '@gltf-transform/extensions'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildEncodePlan } from './ktx2Plan.ts'
import { executeEncodePlan, type Ktx2Runner } from './ktx2Encode.ts'
import { DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'
import {
  KTX2_PLACEHOLDER,
  docWithTextures,
  textureByName,
  type TextureFixture,
} from './texture.fixtures.ts'

const settings = DEFAULT_OPTIMIZE_SETTINGS

// A runner whose ktx calls are gated on released barriers, so a test can
// observe how many entries the pool keeps in flight. The peak is read
// through a getter, after the pool has run. Like ktx, the runner writes
// the encoded output to the target path, the last argument.
function gatedKtxRunner(barriers: Promise<void>[]): { runKtx: Ktx2Runner; peak: () => number } {
  let active = 0
  let peak = 0
  const runKtx: Ktx2Runner = async (args) => {
    active += 1
    peak = Math.max(peak, active)
    const barrier = barriers.shift()
    if (barrier !== undefined) {
      await barrier
    }
    await writeFile(args[args.length - 1] ?? '', KTX2_PLACEHOLDER)
    active -= 1
  }
  return { runKtx, peak: () => peak }
}

describe('executeEncodePlan', () => {
  let workspaceDir = ''

  beforeAll(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), 'ktx2-execute-test-'))
  })

  afterAll(async () => {
    await rm(workspaceDir, { recursive: true, force: true })
  })

  const defs: readonly TextureFixture[] = [
    { name: 'ao-only', slots: ['occlusionTexture'] },
    { name: 'opaque-color', slots: ['baseColorTexture'] },
  ]

  it('writes every planned image back as KTX2 and rewrites a URI to the ktx2 basename', async () => {
    const doc = docWithTextures(defs)
    const plan = buildEncodePlan(doc, settings)
    const texture = textureByName(doc, 'ao-only')
    texture?.setURI('textures/ao.png')
    const calls: string[][] = []
    await executeEncodePlan({
      doc,
      plan,
      workspaceDir,
      jobs: settings.ktxJobs,
      runKtx: async (args) => {
        calls.push([...args])
        // Stand in for ktx: write the encoded output to the target path.
        await writeFile(args[args.length - 1] ?? '', KTX2_PLACEHOLDER)
      },
    })
    // The planned arguments are spawned verbatim with the file names
    // resolved against the workspace. The pool starts the encodes in order
    // but they settle concurrently, so the calls are matched by their
    // unique target path, not by order.
    expect(calls).toHaveLength(plan.entries.length)
    for (const entry of plan.entries) {
      const expected = [
        ...entry.arguments.slice(0, -2),
        path.join(workspaceDir, entry.sourceName),
        path.join(workspaceDir, entry.targetName),
      ]
      const call = calls.find(
        (candidate) => candidate[candidate.length - 1] === expected[expected.length - 1],
      )
      expect(call, entry.label).toEqual(expected)
    }
    for (const def of defs) {
      expect(textureByName(doc, def.name)?.getMimeType()).toBe('image/ktx2')
    }
    // The URI keeps its basename and gains the ktx2 extension.
    expect(textureByName(doc, 'ao-only')?.getURI()).toBe('ao.ktx2')
  })

  it('keeps at most the given number of encodes in flight', async () => {
    const doc = docWithTextures([
      { name: 't1', slots: ['occlusionTexture'] },
      { name: 't2', slots: ['occlusionTexture'] },
      { name: 't3', slots: ['occlusionTexture'] },
      { name: 't4', slots: ['occlusionTexture'] },
    ])
    const plan = buildEncodePlan(doc, settings)
    // Two barriers: the first two entries block until released, so the
    // pool's peak in-flight count shows the bound of two.
    const release: (() => void)[] = []
    const barriers = [0, 1].map(
      () =>
        new Promise<void>((resolve) => {
          release.push(resolve)
        }),
    )
    const { runKtx, peak } = gatedKtxRunner(barriers)
    const done = executeEncodePlan({ doc, plan, workspaceDir, jobs: 2, runKtx })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(peak()).toBe(2)
    for (const resolve of release) {
      resolve()
    }
    await done
  })

  it('requires KHR_texture_basisu while entries exist, and disposes it when none remain', async () => {
    const encodingDoc = docWithTextures(defs)
    await executeEncodePlan({
      doc: encodingDoc,
      plan: buildEncodePlan(encodingDoc, settings),
      workspaceDir,
      jobs: settings.ktxJobs,
      runKtx: async () => undefined,
    })
    const required = encodingDoc
      .getRoot()
      .listExtensionsUsed()
      .find((extension) => extension.extensionName === KHRTextureBasisu.EXTENSION_NAME)
    expect(required).toBeDefined()
    expect(required?.isRequired()).toBe(true)

    // A document whose textures are all already KTX2 keeps the extension.
    const passthroughDoc = docWithTextures([{ name: 'ao-only', slots: ['occlusionTexture'] }])
    textureByName(passthroughDoc, 'ao-only')?.setMimeType('image/ktx2')
    await executeEncodePlan({
      doc: passthroughDoc,
      plan: buildEncodePlan(passthroughDoc, settings),
      workspaceDir,
      jobs: settings.ktxJobs,
      runKtx: async () => undefined,
    })
    const kept = passthroughDoc
      .getRoot()
      .listExtensionsUsed()
      .find((extension) => extension.extensionName === KHRTextureBasisu.EXTENSION_NAME)
    expect(kept?.isRequired()).toBe(true)

    // With nothing encoded and nothing KTX2, the extension is disposed.
    const emptyDoc = docWithTextures([{ name: 'ao-only', slots: ['occlusionTexture'] }])
    await executeEncodePlan({
      doc: emptyDoc,
      plan: { entries: [] },
      workspaceDir,
      jobs: settings.ktxJobs,
      runKtx: async () => undefined,
    })
    const disposed = emptyDoc
      .getRoot()
      .listExtensionsUsed()
      .find((extension) => extension.extensionName === KHRTextureBasisu.EXTENSION_NAME)
    expect(disposed).toBeUndefined()
  })

  it('fails loudly when a ktx encode fails, after every task settles', async () => {
    const doc = docWithTextures([
      { name: 't1', slots: ['occlusionTexture'] },
      { name: 't2', slots: ['baseColorTexture'] },
    ])
    const plan = buildEncodePlan(doc, settings)
    let startedTasks = 0
    await expect(
      executeEncodePlan({
        doc,
        plan,
        workspaceDir,
        jobs: settings.ktxJobs,
        runKtx: async (args) => {
          startedTasks += 1
          if (args.some((arg) => arg.endsWith('0.ktx2'))) {
            throw new Error('ktx exploded')
          }
        },
      }),
    ).rejects.toThrow('ktx exploded')
    expect(startedTasks).toBe(plan.entries.length)
  })
})
