// The control of the contract rules: the placeholder speaker fixture, the
// one real product in the repo that predates the occlusion and home-fit
// contract, validated explicitly through the same facts the validate step
// reads. The shipped products pass every rule (validateProduct.test.ts);
// this file holds the other side: the rules bite the file they were
// written to catch, and the control cannot pass while the fixture model
// stays as it is.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { authoredCameraAspect } from '../src/lib/camera/config.ts'
import { parseProduct } from '../src/lib/product/index.ts'
import { readContractModelFacts } from './contractFacts.ts'
import { runContractRules } from './contractRules.ts'
import type { ContractRuleMessages, ContractRuleGroup } from './contractRules.ts'
import { fixtureManifestPathOf, modelPathOf } from './fixtureProducts.ts'
import { allowanceShareOf, frameExtentOf, nearestCornerDepthOf } from './homeFit.ts'
import { readHomeFitFacts } from './homeFitFacts.ts'
import { loadParseProduct, readManifestFile } from './manifestIo.ts'
import { createModelIO } from './modelIo.ts'
import { deriveStorageBounds } from './storageBounds.ts'
import { readPositionStorage, readTranslationFilters } from './storageFacts.ts'
import { readProductStructure } from './structure.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SLUG = 'placeholder-speaker'

async function controlFindings(): Promise<ReadonlyMap<ContractRuleGroup, ContractRuleMessages>> {
  const io = await createModelIO()
  const modelPath = await modelPathOf(ROOT, SLUG)
  const doc = await io.read(modelPath)
  const structure = readProductStructure(doc)
  const load = await readManifestFile(fixtureManifestPathOf(ROOT, SLUG))
  if (load.kind !== 'loaded') {
    throw new Error(`the fixture manifest of ${SLUG} did not load`)
  }
  return runContractRules({
    manifest: parseProduct(load.manifest, fixtureManifestPathOf(ROOT, SLUG)),
    structure,
    facts: readContractModelFacts(doc),
    homeFit: readHomeFitFacts(doc, structure.animationChannels),
    storage: {
      positions: readPositionStorage(doc),
      translationFilters: await readTranslationFilters(modelPath),
    },
    storageBounds: await deriveStorageBounds(),
    contract: (await import('./validateFixtures.ts')).cameraContract,
  })
}

describe('the placeholder fixture, validated explicitly', () => {
  it('fails the home fit: the clip drives rotation, and the assembled pose overflows the frame', async () => {
    const violations = (await controlFindings()).get('cameras')?.violations ?? []
    const homeFit = violations.filter((message) => message.startsWith('home-holds-both-poses:'))
    expect(homeFit).toEqual([
      expect.stringMatching(/^home-holds-both-poses: rotation channel bound not implemented/),
    ])

    // The overflow the fixture carries, measured the way the rule measures
    // it: the assembled pose keeps a negative share of the half frame, an
    // overflow of about 5.9 percent of the frame, far beyond anything the
    // file's own storage can spend.
    const io = await createModelIO()
    const doc = await io.read(await modelPathOf(ROOT, SLUG))
    const structure = readProductStructure(doc)
    const homeFitFacts = readHomeFitFacts(doc, structure.animationChannels)
    const home = structure.cameraFacts.find((fact) => fact.name === 'CAM_home')
    if (home === undefined || home.ray === null) {
      throw new Error('the fixture carries no CAM_home ray')
    }
    const extent = frameExtentOf(
      homeFitFacts.assembled.points,
      home.ray.position,
      home.ray.forward,
      home.ray.fovY,
      authoredCameraAspect,
    )
    expect(extent.free).toBeCloseTo(-0.059, 2)
    const allowance = allowanceShareOf(
      Math.sqrt(3) * 0.00008390075151198939 * homeFitFacts.sigmaMax,
      nearestCornerDepthOf(homeFitFacts.assembled.points, home.ray.position, home.ray.forward),
      home.ray.fovY,
    )
    expect(extent.free).toBeLessThan(0.06 - allowance)
  })

  it('fails the occlusion rules: four AO images across the file, every slot at texCoord 0', async () => {
    const violations = (await controlFindings()).get('materials')?.violations ?? []
    const byRule = (key: string) => violations.filter((message) => message.startsWith(`${key}:`))
    expect(byRule('one-occlusion-image')).toEqual([
      expect.stringMatching(/^one-occlusion-image: the occlusion slots sample 4 images/),
    ])
    const texCoord = byRule('occlusion-texcoord-second-set')
    expect(texCoord).toHaveLength(6)
    for (const message of texCoord) {
      expect(message).toMatch(/samples texCoord 0, the occlusion UV map is TEXCOORD_1$/)
    }
    expect(byRule('lit-materials-occluded')).toEqual([])
  })

  it('fails the storage rule: a translation output the pipeline never writes', async () => {
    const violations = (await controlFindings()).get('model')?.violations ?? []
    expect(violations).toContainEqual(
      "storage-matches-pipeline: a translation output of the animation 'Explode' is stored with " +
        "filter QUATERNION, the pipeline's key filter is EXPONENTIAL at 12 bits",
    )
  })

  it('fails the first-key rule through the same rotation guard', async () => {
    const violations = (await controlFindings()).get('explode')?.violations ?? []
    expect(violations).toContainEqual(
      expect.stringMatching(/^clip-first-key-at-rest: rotation channel bound not implemented/),
    )
  })

  it('parses the fixture manifest through the real schema', async () => {
    const parseProduct = await loadParseProduct()
    const load = await readManifestFile(fixtureManifestPathOf(ROOT, SLUG))
    if (load.kind !== 'loaded') {
      throw new Error(`the fixture manifest of ${SLUG} did not load`)
    }
    expect(parseProduct(load.manifest, 'fixture-control').slug).toBe(SLUG)
  })
})
