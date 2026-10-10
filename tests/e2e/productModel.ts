/// <reference types="node" />
import { fileURLToPath } from 'node:url'
import type { Accessor, Animation } from '@gltf-transform/core'
import { modelPathOf } from '../../scripts/fixtureProducts.ts'
import { readProductStructure } from '../../scripts/structure.ts'
import { HOTSPOT_PREFIX, PART_PREFIX } from '../../src/lib/product/contractNames.ts'
import { frozen, frozenShallow } from './frozenFacts'
import { memoizedRead, readSharedModelDocument } from './sharedProductModels'

// The committed model's own facts, read once per spec from the file the
// site ships: what the rig summary must report, derived from the model
// itself instead of hand-typed guesses. The manifest supplies the words
// (hotspot ids, variants, clip name); everything the manifest cannot say
// comes from here.

// The repo root: the parent of the tests folder this file lives in.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export type ProductModelFacts = {
  // Every PART_ node name, sorted.
  readonly partNames: readonly string[]
  // Every camera node name, sorted.
  readonly cameraNames: readonly string[]
  // Hotspot id to the PART_ node its HS_ anchor rides on, by nearest named
  // ancestor.
  readonly hotspotParts: ReadonlyMap<string, string>
  // The one animation's name and its full length in seconds.
  readonly clipName: string
  readonly clipDurationSeconds: number
}

// The model facts per slug, read once per process: every spec file's top
// level read of the same product shares the one derivation.
const factsBySlug = new Map<string, Promise<ProductModelFacts>>()

export function readProductModelFacts(slug: string): Promise<ProductModelFacts> {
  return memoizedRead(factsBySlug, slug, async () => {
    const modelPath = await modelPathOf(ROOT, slug)
    const doc = await readSharedModelDocument(modelPath)
    const structure = readProductStructure(doc)

    const animations = doc.getRoot().listAnimations()
    if (animations.length !== 1) {
      throw new Error(`expected exactly one animation in ${modelPath}, found ${animations.length}`)
    }
    const animation = animations[0]
    if (animation === undefined) {
      throw new Error(`the animation of ${modelPath} is missing`)
    }

    return frozen({
      partNames: structure.nodeNames.filter((name) => name.startsWith(PART_PREFIX)).sort(),
      cameraNames: structure.cameraNames.sort(),
      hotspotParts: frozenShallow(hotspotPartMap(structure.hotspotAnchors)),
      clipName: animation.getName(),
      clipDurationSeconds: clipDuration(animation),
    })
  })
}

function hotspotPartMap(anchors: readonly { name: string; parentName: string | null }[]) {
  const parts = new Map<string, string>()
  for (const anchor of anchors) {
    if (anchor.parentName === null || !anchor.parentName.startsWith(PART_PREFIX)) {
      throw new Error(`hotspot ${anchor.name} has no PART_ parent in the committed model`)
    }
    parts.set(anchor.name.slice(HOTSPOT_PREFIX.length), anchor.parentName)
  }
  return parts
}

// The clip's full length: the largest time any sampler's input reaches,
// which is the duration the runtime loader computes from the same data.
function clipDuration(animation: Animation): number {
  let duration = 0
  for (const sampler of animation.listSamplers()) {
    const input = sampler.getInput()
    if (input === null) {
      throw new Error('an animation sampler without an input accessor')
    }
    duration = Math.max(duration, accessorMax(input))
  }
  return duration
}

function accessorMax(accessor: Accessor): number {
  const max = accessor.getMax([])
  if (max === undefined || max.length === 0) {
    throw new Error('an animation input accessor without a maximum')
  }
  return Math.max(...max)
}
