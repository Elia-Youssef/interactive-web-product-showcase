// The explode-group rules over the fixture document: each rule passes on
// the valid document and fails once on the one defect that breaks it, by
// the exact message the rule reports.
import { describe, expect, it } from 'vitest'
import { explodeRules } from './contractRuleExplode.ts'
import { buildDocument, nodeNamed } from './validateFixtures.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'

const byKey = new Map(explodeRules.map((rule) => [rule.key, rule]))

function violationsOf(
  key: string,
  plant: (doc: ReturnType<typeof buildDocument>) => void,
): readonly string[] {
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
  it('passes every rule on the valid document', () => {
    const input = contractRuleInputOf(buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }))
    for (const rule of explodeRules) {
      expect(rule.check(input), rule.key).toEqual({ violations: [], warnings: [] })
    }
  })

  it('the channels rule reports one on a node that is no part, and a scale channel', () => {
    expect(
      violationsOf('clip-channels-on-parts', (doc) => {
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
      violationsOf('clip-channels-on-parts', (doc) => {
        const animation = doc.getRoot().listAnimations()[0]
        const sampler = samplerOf(doc)
        const channel = doc.createAnimationChannel()
        channel.setSampler(sampler)
        channel.setTargetNode(nodeNamed(doc, 'PART_base'))
        channel.setTargetPath('scale')
        animation?.addChannel(channel)
      }),
    ).toEqual([
      'the animation drives scale on PART_base, only location and rotation channels are allowed',
    ])
  })

  it('the first-key rule reports one off the rest pose, and passes the stored one', () => {
    expect(
      violationsOf('clip-first-key-at-rest', (doc) => {
        const output = samplerOf(doc).getOutput()
        output?.setArray(new Float32Array([0.2, 0, 0, 0, 1, 0]))
      }),
    ).toEqual([
      "the first translation key of PART_base sits 0.2 off the node's rest pose, beyond the animation storage window 0.001",
    ])
    expect(
      violationsOf('clip-first-key-at-rest', (doc) => {
        const output = samplerOf(doc).getOutput()
        output?.setArray(new Float32Array([0.0005, 0, 0, 0, 1, 0]))
      }),
    ).toEqual([])
  })

  it('the dead-length rule reports a dead head, a dead tail, a late start and a still clip', () => {
    expect(
      violationsOf('clip-no-dead-head-or-tail', (doc) => {
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
      violationsOf('clip-no-dead-head-or-tail', (doc) => {
        const sampler = samplerOf(doc)
        const input = sampler.getInput()
        input?.setArray(new Float32Array([0, 0.5, 1]))
        const output = sampler.getOutput()
        output?.setArray(new Float32Array([0, 0, 0, 0, 1, 0, 0, 1, 0]))
      }),
    ).toEqual(['the clip ends at 1 s but its last motion ends at 0.5 s, its tail is dead'])
    expect(
      violationsOf('clip-no-dead-head-or-tail', (doc) => {
        const sampler = samplerOf(doc)
        const input = sampler.getInput()
        input?.setArray(new Float32Array([0.2, 1]))
        const output = sampler.getOutput()
        output?.setArray(new Float32Array([0, 0, 0, 0, 1, 0]))
      }),
    ).toEqual(['the clip starts at 0.2 s, motion starts at 0 s'])
    expect(
      violationsOf('clip-no-dead-head-or-tail', (doc) => {
        const output = samplerOf(doc).getOutput()
        output?.setArray(new Float32Array([0, 0, 0, 0, 0, 0]))
      }),
    ).toEqual(['the clip moves nothing, its whole length is dead'])
  })
})
