// The camera-group rules over the fixture document: the static-roll-free
// rule holds every camera roll-free, unparented and unanimated; the
// authored-minimum rule warns about a minimum the default limits never
// needed, and stays quiet about one a view needs.
import { describe, expect, it } from 'vitest'
import { cameraRules } from './contractRuleCameras.ts'
import { addRotationChannel, buildDocument, nodeNamed } from './validateFixtures.ts'
import { contractRuleInputOf, ruleFixtureManifest } from './contractRuleFixtures.ts'
import type { ContractRuleInput } from './contractRules.ts'

const byKey = new Map(cameraRules.map((rule) => [rule.key, rule]))

async function inputOf(
  plant: (doc: ReturnType<typeof buildDocument>) => void,
  camera?: { minDistance?: number },
): Promise<ContractRuleInput> {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  plant(doc)
  const input = await contractRuleInputOf(doc)
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
  it('passes every rule on the valid document', async () => {
    const messages = messagesOf('camera-static-roll-free', await inputOf(() => {}))
    expect(messages).toEqual({ violations: [], warnings: [] })
    expect(messagesOf('authored-minimum-needed', await inputOf(() => {})).warnings).toEqual([])
  })

  it('the static rule reports a rolled camera by the degrees it rolls', async () => {
    const quarterTurn = Math.sin(Math.PI / 8)
    const messages = messagesOf(
      'camera-static-roll-free',
      await inputOf((doc) => {
        nodeNamed(doc, 'CAM_home').setRotation([0, 0, quarterTurn, Math.cos(Math.PI / 8)])
      }),
    )
    expect(messages.violations).toEqual([
      'the camera CAM_home rolls -45 degrees from the roll-free up, the controls rebuild every view with world up',
    ])
  })

  it('the static rule reports a parented camera and an animated one', async () => {
    expect(
      messagesOf(
        'camera-static-roll-free',
        await inputOf((doc) => {
          nodeNamed(doc, 'PART_base').addChild(nodeNamed(doc, 'CAM_home'))
        }),
      ).violations,
    ).toEqual(['the camera CAM_home is not a root object, cameras parent nowhere'])
    expect(
      messagesOf(
        'camera-static-roll-free',
        await inputOf((doc) => {
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

  it('the authored-minimum rule warns about one the default limits pass without', async () => {
    const messages = messagesOf(
      'authored-minimum-needed',
      await inputOf(() => {}, { minDistance: 1.9 }),
    )
    expect(messages.violations).toEqual([])
    expect(messages.warnings).toEqual([
      'camera.minDistance 1.9 is authored but the default minimum 2 passes every rule that reads the minimum: ' +
        'an authored value with no product cause is a tolerance',
    ])
  })

  it('the authored-minimum rule stays quiet about a minimum a view needs', async () => {
    // The driver close-up moves in to 1.5, below the default minimum of 2:
    // the default limits fail, so an authored minimum has a cause, at 1.5
    // or anywhere under the close-up.
    const moved = (doc: ReturnType<typeof buildDocument>) => {
      nodeNamed(doc, 'CAM_driver').setTranslation([1, 1, 1.5])
    }
    expect(
      messagesOf('authored-minimum-needed', await inputOf(moved, { minDistance: 1.5 })).warnings,
    ).toEqual([])
    expect(
      messagesOf('authored-minimum-needed', await inputOf(moved, { minDistance: 1.9 })).warnings,
    ).toEqual([])
  })

  it('the home-fit rule holds both poses on the valid document', async () => {
    expect(messagesOf('home-holds-both-poses', await inputOf(() => {})).violations).toEqual([])
  })

  it('the home-fit rule reports a pose that falls below the margin beyond the storage allowance', async () => {
    // The body part grown fourfold overflows the home frame outright: the
    // assembled free share goes negative, orders past what the file's own
    // storage can spend.
    const grown = (doc: ReturnType<typeof buildDocument>) => {
      const mesh = nodeNamed(doc, 'PART_body').getMesh()
      const position = mesh?.listPrimitives()[0]?.getAttribute('POSITION')
      position?.setArray(new Float32Array([0, 0, 0, 8, 0, 0, 0, 8, 0, 8, 8, 0]))
    }
    // Both poses overflow: the grown part sits in both of them.
    const violations = messagesOf('home-holds-both-poses', await inputOf(grown)).violations
    expect(violations).toHaveLength(2)
    expect(violations[0]).toMatch(
      /^the assembled pose keeps -\d+\.\d+ of the half frame free at home, .* bound by the PART_body mesh$/,
    )
    expect(violations[1]).toMatch(
      /^the exploded pose keeps -\d+\.\d+ of the half frame free at home, .* bound by the PART_body mesh$/,
    )
  })

  it('the home-fit rule measures the assembled pose of a clip with a rotation channel', async () => {
    // A rotation key has no derived storage bound, so the exploded pose is
    // named instead of compared; the assembled pose reads no key and holds.
    const rotated = (doc: ReturnType<typeof buildDocument>) => addRotationChannel(doc, 'PART_knob')
    expect(messagesOf('home-holds-both-poses', await inputOf(rotated)).violations).toEqual([
      'the exploded pose is not compared: the clip drives rotation on PART_knob, ' +
        'whose stored keys have no derived storage bound',
    ])
  })

  it('the home-fit rule reports a document without a home camera', async () => {
    const doc = buildDocument({
      hotspotNames: ['HS_driver', 'HS_knob'],
      cameraNames: ['CAM_driver'],
    })
    const rule = byKey.get('home-holds-both-poses')
    if (rule === undefined) {
      throw new Error('the camera rules hold no home-holds-both-poses')
    }
    expect(rule.check(await contractRuleInputOf(doc)).violations).toEqual([
      'the home fit needs a perspective CAM_home with a stored ray',
    ])
  })
})
