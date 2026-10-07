// The camera-group rules over the fixture document: the static-roll-free
// rule holds every camera roll-free, unparented and unanimated; the
// authored-minimum rule warns about a minimum the default limits never
// needed, and stays quiet about one a view needs.
import { describe, expect, it } from 'vitest'
import { cameraRules } from './contractRuleCameras.ts'
import { buildDocument, nodeNamed } from './validateFixtures.ts'
import { contractRuleInputOf, ruleFixtureManifest } from './contractRuleFixtures.ts'
import type { ContractRuleInput } from './contractRules.ts'

const byKey = new Map(cameraRules.map((rule) => [rule.key, rule]))

function inputOf(
  plant: (doc: ReturnType<typeof buildDocument>) => void,
  camera?: { minDistance?: number },
): ContractRuleInput {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  plant(doc)
  const input = contractRuleInputOf(doc)
  return camera === undefined ? input : { ...input, manifest: ruleFixtureManifest(camera) }
}

function messagesOf(key: string, input: ContractRuleInput) {
  const rule = byKey.get(key)
  if (rule === undefined) {
    throw new Error(`the camera rules hold no ${key}`)
  }
  return rule.check(input)
}

describe('the camera-group contract rules', () => {
  it('passes every rule on the valid document', () => {
    const messages = messagesOf(
      'camera-static-roll-free',
      inputOf(() => {}),
    )
    expect(messages).toEqual({ violations: [], warnings: [] })
    expect(
      messagesOf(
        'authored-minimum-needed',
        inputOf(() => {}),
      ).warnings,
    ).toEqual([])
  })

  it('the static rule reports a rolled camera by the degrees it rolls', () => {
    const quarterTurn = Math.sin(Math.PI / 8)
    const messages = messagesOf(
      'camera-static-roll-free',
      inputOf((doc) => {
        nodeNamed(doc, 'CAM_home').setRotation([0, 0, quarterTurn, Math.cos(Math.PI / 8)])
      }),
    )
    expect(messages.violations).toEqual([
      'the camera CAM_home rolls -45 degrees from the roll-free up, the controls rebuild every view with world up',
    ])
  })

  it('the static rule reports a parented camera and an animated one', () => {
    expect(
      messagesOf(
        'camera-static-roll-free',
        inputOf((doc) => {
          nodeNamed(doc, 'PART_base').addChild(nodeNamed(doc, 'CAM_home'))
        }),
      ).violations,
    ).toEqual(['the camera CAM_home is not a root object, cameras parent nowhere'])
    expect(
      messagesOf(
        'camera-static-roll-free',
        inputOf((doc) => {
          const animation = doc.getRoot().listAnimations()[0]
          const sampler = animation?.listChannels()[0]?.getSampler()
          if (animation === undefined || sampler === undefined) {
            throw new Error('the fixture holds the explode clip with one channel')
          }
          const channel = doc.createAnimationChannel()
          channel.setSampler(sampler)
          channel.setTargetNode(nodeNamed(doc, 'CAM_home'))
          channel.setTargetPath('translation')
          animation.addChannel(channel)
        }),
      ).violations,
    ).toEqual(['the camera CAM_home is animated, cameras are read at the rest pose'])
  })

  it('the authored-minimum rule warns about one the default limits pass without', () => {
    const messages = messagesOf(
      'authored-minimum-needed',
      inputOf(() => {}, { minDistance: 1.9 }),
    )
    expect(messages.violations).toEqual([])
    expect(messages.warnings).toEqual([
      'camera.minDistance 1.9 is authored but the default minimum 2 passes every rule that reads the minimum: ' +
        'an authored value with no product cause is a tolerance',
    ])
  })

  it('the authored-minimum rule stays quiet about a minimum a view needs', () => {
    // The driver close-up moves in to 1.5, below the default minimum of 2:
    // the default limits fail, so an authored minimum has a cause, at 1.5
    // or anywhere under the close-up.
    const moved = (doc: ReturnType<typeof buildDocument>) => {
      nodeNamed(doc, 'CAM_driver').setTranslation([1, 1, 1.5])
    }
    expect(
      messagesOf('authored-minimum-needed', inputOf(moved, { minDistance: 1.5 })).warnings,
    ).toEqual([])
    expect(
      messagesOf('authored-minimum-needed', inputOf(moved, { minDistance: 1.9 })).warnings,
    ).toEqual([])
  })
})
