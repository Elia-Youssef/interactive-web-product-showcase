// The control of the contract rules: the placeholder speaker fixture, the
// one real product in the repo that predates the occlusion and home-fit
// contract, validated explicitly through the same facts the validate step
// reads. The shipped products pass every rule (validateProduct.test.ts);
// this file holds the other side: the rules bite the file they were
// written to catch, and the control cannot pass while the fixture model
// stays as it is.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { homeFitMargin } from '../src/lib/camera/config.ts'
import { parseProduct } from '../src/lib/product/index.ts'
import { readContractModelFacts } from './contractFacts.ts'
import { runContractRules } from './contractRules.ts'
import type { ContractRuleGroup, ContractRuleInput, ContractRuleMessages } from './contractRules.ts'
import { fixtureManifestPathOf, modelPathOf } from './fixtureProducts.ts'
import { homeFitReportOf, poseViolationOf } from './homeFitRule.ts'
import { readHomeFitFacts } from './homeFitFacts.ts'
import { loadParseProduct, readManifestFile } from './manifestIo.ts'
import { createModelIO } from './modelIo.ts'
import { deriveStorageBounds } from './storageBounds.ts'
import { pipelinePositionGrid } from './storageGrid.ts'
import { readPositionStorage, readTranslationOutputs } from './storageFacts.ts'
import { readProductStructure } from './structure.ts'
import { cameraContract } from './validateFixtures.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SLUG = 'placeholder-speaker'

// The rule table's input over the fixture, read through the same facts the
// validate step reads.
async function controlInput(): Promise<ContractRuleInput> {
  const io = await createModelIO()
  const modelPath = await modelPathOf(ROOT, SLUG)
  const doc = await io.read(modelPath)
  const structure = readProductStructure(doc)
  const load = await readManifestFile(fixtureManifestPathOf(ROOT, SLUG))
  if (load.kind !== 'loaded') {
    throw new Error(`the fixture manifest of ${SLUG} did not load`)
  }
  return {
    manifest: parseProduct(load.manifest, fixtureManifestPathOf(ROOT, SLUG)),
    structure,
    facts: readContractModelFacts(doc),
    homeFit: readHomeFitFacts(doc, structure.animationChannels),
    storage: {
      positions: readPositionStorage(doc, await pipelinePositionGrid()),
      translationOutputs: await readTranslationOutputs(io, modelPath),
    },
    storageBounds: await deriveStorageBounds(),
    contract: cameraContract,
  }
}

async function controlFindings(): Promise<ReadonlyMap<ContractRuleGroup, ContractRuleMessages>> {
  return runContractRules(await controlInput())
}

describe('the placeholder fixture, validated explicitly', () => {
  it('fails the home fit on its assembled pose, by the verdict the rule prints', async () => {
    const input = await controlInput()
    const report = homeFitReportOf(input)
    if (report.kind !== 'measured') {
      throw new Error(`the fixture's home fit answered ${report.kind}, not a measurement`)
    }
    const assembled = report.poses.find((pose) => pose.pose === 'assembled')
    if (assembled?.kind !== 'verdict') {
      throw new Error('the home fit measured no assembled pose')
    }
    // The assembled pose reads no animation key, so its verdict stands
    // whatever the clip drives: it misses the contract margin.
    expect(assembled.holds).toBe(false)
    expect(assembled.free).toBeLessThan(homeFitMargin)
    const violations = runContractRules(input).get('cameras')?.violations ?? []
    expect(violations).toContain(`home-holds-both-poses: ${poseViolationOf(assembled)}`)
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

  it('holds the storage rule: its rotation output is no translation output', async () => {
    // The clip's rotation output is stored through the quaternion filter,
    // the meshopt writer's own choice for a rotation channel; the storage
    // rule reads translation outputs only, by the channel that reads them.
    const violations = (await controlFindings()).get('model')?.violations ?? []
    expect(violations.filter((message) => message.startsWith('storage-matches-pipeline:'))).toEqual(
      [],
    )
  })

  it('fails the channels rule on every rotation channel its clip drives', async () => {
    const input = await controlInput()
    const rotations = input.structure.animationChannels.filter(
      (channel) => channel.path === 'rotation',
    )
    expect(rotations.length).toBeGreaterThan(0)
    const violations = runContractRules(input).get('explode')?.violations ?? []
    expect(violations.filter((message) => message.startsWith('clip-channels-on-parts:'))).toEqual(
      rotations.map(
        (channel) =>
          `clip-channels-on-parts: the animation drives rotation on ${channel.targetName}, ` +
          'only location channels are allowed: the storage bound of a stored key is derived ' +
          'for translation keys only',
      ),
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
