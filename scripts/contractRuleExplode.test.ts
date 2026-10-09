// The explode-group rules over the fixture document: each rule passes on
// the valid document and fails once on the one defect that breaks it, by
// the exact message the rule reports.
import { describe, expect, it } from 'vitest'
import { explodeRules } from './contractRuleExplode.ts'
import { addRotationChannel, buildDocument, nodeNamed } from './validateFixtures.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'

const byKey = new Map(explodeRules.map((rule) => [rule.key, rule]))

async function violationsOf(
  key: string,
  plant: (doc: ReturnType<typeof buildDocument>) => void,
): Promise<readonly string[]> {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  plant(doc)
  const rule = byKey.get(key)
  if (rule === undefined) {
    throw new Error(`the explode rules hold no ${key}`)
  }
  return rule.check(contractRuleInputOf(doc)).violations
}

// The fixture clip's one sampler, to bend its times and keys.
function samplerOf(doc: ReturnType<typeof buildDocument>) {
  const animation = doc.getRoot().listAnimations()[0]
  const sampler = animation?.listChannels()[0]?.getSampler() ?? null
  if (animation === undefined || sampler === null) {
    throw new Error('the fixture holds the explode clip with one channel')
  }
  return sampler
}

describe('the explode-group contract rules', () => {
  it('passes every rule on the valid document', async () => {
    const input = contractRuleInputOf(buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }))
    for (const rule of explodeRules) {
      expect(rule.check(input), rule.key).toEqual({ violations: [], warnings: [] })
    }
  })

  it('the channels rule reports one on a node that is no part, and a scale channel', async () => {
    expect(
      await violationsOf('clip-channels-on-parts', (doc) => {
        const animation = doc.getRoot().listAnimations()[0]
        const sampler = samplerOf(doc)
        const channel = doc.createAnimationChannel()
        channel.setSampler(sampler)
        channel.setTargetNode(nodeNamed(doc, 'SHADOW'))
        channel.setTargetPath('translation')
        animation?.addChannel(channel)
      }),
    ).toEqual(["the animation drives translation on 'SHADOW', channels drive PART_ nodes only"])
    expect(
      await violationsOf('clip-channels-on-parts', (doc) => {
        const animation = doc.getRoot().listAnimations()[0]
        const sampler = samplerOf(doc)
        const channel = doc.createAnimationChannel()
        channel.setSampler(sampler)
        channel.setTargetNode(nodeNamed(doc, 'PART_base'))
        channel.setTargetPath('scale')
        animation?.addChannel(channel)
      }),
    ).toEqual([
      'the animation drives scale on PART_base, only location channels are allowed: ' +
        'the storage bound of a stored key is derived for translation keys only',
    ])
  })

  it('the channels rule refuses a rotation channel, which the first-key rule leaves to it', async () => {
    const rotated = (doc: ReturnType<typeof buildDocument>) => addRotationChannel(doc, 'PART_knob')
    expect(await violationsOf('clip-channels-on-parts', rotated)).toEqual([
      'the animation drives rotation on PART_knob, only location channels are allowed: ' +
        'the storage bound of a stored key is derived for translation keys only',
    ])
    expect(await violationsOf('clip-first-key-at-rest', rotated)).toEqual([])
  })

  it('the first-key rule reports one off the rest pose, and passes the stored one', async () => {
    expect(
      await violationsOf('clip-first-key-at-rest', (doc) => {
        const output = samplerOf(doc).getOutput()
        output?.setArray(new Float32Array([0.2, 0, 0, 0, 1, 0]))
      }),
    ).toEqual([
      "the first translation key of PART_base sits 0.2 off the node's rest pose, beyond the stored key's bound 9.766e-5",
    ])
    expect(
      await violationsOf('clip-first-key-at-rest', (doc) => {
        nodeNamed(doc, 'PART_base').setTranslation([1, 0, 0])
        const output = samplerOf(doc).getOutput()
        // 0.0004 off a rest at 1 sits inside the key's own bound: 2^-11 of
        // the stored magnitude 1.0004 is 4.9e-4, and this is what the key
        // filter may move a stored key by.
        output?.setArray(new Float32Array([1.0004, 0, 0, 1.0004, 1, 0]))
      }),
    ).toEqual([])
  })

  it('the dead-length rule reports a dead head, a dead tail, a late start and a still clip', async () => {
    expect(
      await violationsOf('clip-no-dead-head-or-tail', (doc) => {
        const sampler = samplerOf(doc)
        const input = sampler.getInput()
        input?.setArray(new Float32Array([0, 0.5, 1]))
        const output = sampler.getOutput()
        output?.setArray(new Float32Array([0, 0, 0, 0, 0, 0, 0, 1, 0]))
      }),
    ).toEqual([
      "the clip's first motion starts at 0.5 s, after its first key at 0 s: its head is dead",
    ])
    expect(
      await violationsOf('clip-no-dead-head-or-tail', (doc) => {
        const sampler = samplerOf(doc)
        const input = sampler.getInput()
        input?.setArray(new Float32Array([0, 0.5, 1]))
        const output = sampler.getOutput()
        output?.setArray(new Float32Array([0, 0, 0, 0, 1, 0, 0, 1, 0]))
      }),
    ).toEqual(['the clip ends at 1 s but its last motion ends at 0.5 s, its tail is dead'])
    expect(
      await violationsOf('clip-no-dead-head-or-tail', (doc) => {
        const sampler = samplerOf(doc)
        const input = sampler.getInput()
        input?.setArray(new Float32Array([0.2, 1]))
        const output = sampler.getOutput()
        output?.setArray(new Float32Array([0, 0, 0, 0, 1, 0]))
      }),
    ).toEqual(['the clip starts at 0.2 s, motion starts at 0 s'])
    expect(
      await violationsOf('clip-no-dead-head-or-tail', (doc) => {
        const output = samplerOf(doc).getOutput()
        output?.setArray(new Float32Array([0, 0, 0, 0, 0, 0]))
      }),
    ).toEqual(['the clip moves nothing, its whole length is dead'])
  })
})
