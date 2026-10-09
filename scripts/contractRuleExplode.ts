// The explode-group rules of the contract, as table entries: channels
// drive PART_ nodes only and only location and rotation, each channel's
// first key equals its node's rest transform within what the file's own
// key storage can move, and the clip has no dead head or tail.

import { PART_PREFIX } from '../src/lib/product/contractNames.ts'
import { translationKeyComponentBound } from './storageBounds.ts'
import type { ChannelFact } from './animationFacts.ts'
import type { ContractRule } from './contractRules.ts'

// A value in a report at four decimals: the keys and times come through
// float32 storage, whose noise no reader needs to see.
function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

export const explodeRules: readonly ContractRule[] = [
  {
    key: 'clip-channels-on-parts',
    group: 'explode',
    check: ({ structure }) => ({
      violations: structure.animationChannels.flatMap((channel) => {
        if (!channel.targetName.startsWith(PART_PREFIX)) {
          return [
            `the animation drives ${channel.path} on '${channel.targetName}', channels drive PART_ nodes only`,
          ]
        }
        if (channel.path !== 'translation' && channel.path !== 'rotation') {
          return [
            `the animation drives ${channel.path} on ${channel.targetName}, only location and rotation channels are allowed`,
          ]
        }
        return []
      }),
      warnings: [],
    }),
  },
  {
    key: 'clip-first-key-at-rest',
    group: 'explode',
    check: ({ facts, structure }) => ({
      violations: structure.animationChannels.flatMap((channel) => {
        const node = facts.nodes.find((candidate) => candidate.name === channel.targetName)
        if (node === undefined) {
          return []
        }
        const rest =
          channel.path === 'rotation'
            ? (node.rotation ?? [0, 0, 0, 1])
            : (node.translation ?? [0, 0, 0])
        return firstKeyOffRest(channel, rest)
      }),
      warnings: [],
    }),
  },
  {
    key: 'clip-no-dead-head-or-tail',
    group: 'explode',
    check: ({ structure }) => {
      const channels = structure.animationChannels
      if (channels.length === 0) {
        return { violations: [], warnings: [] }
      }
      const violations: string[] = []
      const start = Math.min(...channels.map((channel) => Math.min(...channel.times)))
      const end = Math.max(...channels.map((channel) => Math.max(...channel.times)))
      const changes = channels.flatMap(changesOf)
      if (changes.length === 0) {
        return { violations: ['the clip moves nothing, its whole length is dead'], warnings: [] }
      }
      const firstChange = Math.min(...changes.map((change) => change.start))
      const lastChange = Math.max(...changes.map((change) => change.end))
      if (start !== 0) {
        violations.push(`the clip starts at ${round4(start)} s, motion starts at 0 s`)
      }
      if (firstChange !== start) {
        violations.push(
          `the clip's first motion starts at ${round4(firstChange)} s, after its first key at ${round4(start)} s: its head is dead`,
        )
      }
      if (lastChange !== end) {
        violations.push(
          `the clip ends at ${round4(end)} s but its last motion ends at ${round4(lastChange)} s, its tail is dead`,
        )
      }
      return { violations, warnings: [] }
    },
  },
]

// The message for a channel whose first key sits off its node's rest pose
// beyond what the file's own key storage can move. A translation key is
// stored through the pipeline's EXPONENTIAL filter, whose bound the
// storage bounds derive from the key's own magnitude; a rotation key has
// no derived bound, and the rule names that rather than comparing with a
// picked window.
function firstKeyOffRest(channel: ChannelFact, rest: readonly number[]): readonly string[] {
  if (channel.path === 'rotation') {
    return [
      `rotation channel bound not implemented: ${channel.targetName} drives rotation, ` +
        'and the storage bound of a rotation output is not derived; ' +
        'the first-key rule covers translation keys only',
    ]
  }
  const first = keyValuesSlice(channel, 0)
  const worst = Math.max(
    ...Array.from({ length: channel.components }, (_, k) =>
      Math.abs((first[k] ?? 0) - (rest[k] ?? 0)),
    ),
  )
  const bound = translationKeyComponentBound(first)
  if (worst <= bound) {
    return []
  }
  return [
    `the first ${channel.path} key of ${channel.targetName} sits ${round4(worst)} off the node's rest pose, ` +
      `beyond the stored key's bound ${bound.toExponential(3)}`,
  ]
}

// The times between which a channel's value actually changes: the segments
// whose neighbouring keys differ.
function changesOf(channel: ChannelFact): readonly { start: number; end: number }[] {
  const changes: { start: number; end: number }[] = []
  for (let key = 0; key + 1 < channel.times.length; key += 1) {
    const from = keyValuesSlice(channel, key)
    const to = keyValuesSlice(channel, key + 1)
    if (from.some((value, index) => value !== to[index])) {
      changes.push({
        start: channel.times[key] ?? 0,
        end: channel.times[key + 1] ?? 0,
      })
    }
  }
  return changes
}

function keyValuesSlice(channel: ChannelFact, key: number): readonly number[] {
  return Array.from(
    { length: channel.components },
    (_, component) => channel.keyValues[key * channel.components + component] ?? 0,
  )
}
