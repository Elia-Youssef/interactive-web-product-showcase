import { describe, expect, it } from 'vitest'
import type { ProductFailure, ProductFailureKind } from '@lib/product'
import { productFailureMessage } from './failureMessage'

// One failure of every kind, keyed by the kind, so the table cannot miss a
// member of the union: a kind the union gains fails the typecheck here
// until it has a row.
const failures: { readonly [K in ProductFailureKind]: Extract<ProductFailure, { kind: K }> } = {
  load: { kind: 'load', url: '/models/sample-one/model.glb', message: 'Failed to fetch' },
  'model-contract': {
    kind: 'model-contract',
    problems: [
      { node: 'HS_shell', message: 'the anchor is not parented to a part' },
      { node: null, message: 'the model carries no Explode clip' },
    ],
  },
  'finish-contract': {
    kind: 'finish-contract',
    problems: [
      { mesh: 2, primitive: 0, message: 'the mapping at 0 names variant 9, the file declares 2' },
      { mesh: null, primitive: null, message: 'the variant at 1 has no name' },
    ],
  },
  'camera-contract': {
    kind: 'camera-contract',
    problems: [
      { rule: 'view-within-distance-limits', message: 'the CAM_home distance 1.2 lies outside' },
      { rule: 'minimum-clears-the-model', message: 'the minimum distance 0.35 is inside' },
    ],
  },
  presentation: { kind: 'presentation', message: 'the settle rejected' },
  render: { kind: 'render', message: 'a node build threw' },
  unexpected: { kind: 'unexpected', message: 'a programming error' },
}

describe('productFailureMessage', () => {
  it('names the model URL and the loader message of a load failure', () => {
    expect(productFailureMessage(failures.load)).toBe(
      'Could not load /models/sample-one/model.glb: Failed to fetch',
    )
  })

  it('lists every model contract problem on its own line, with its node when it names one', () => {
    expect(productFailureMessage(failures['model-contract']).split('\n')).toEqual([
      'The model breaks the product contract:',
      '- HS_shell: the anchor is not parented to a part',
      '- the model carries no Explode clip',
    ])
  })

  it('lists every finish mapping problem on its own line, at its mesh and primitive', () => {
    expect(productFailureMessage(failures['finish-contract']).split('\n')).toEqual([
      'The model breaks the finish mapping contract:',
      '- mesh 2 primitive 0: the mapping at 0 names variant 9, the file declares 2',
      '- the variant at 1 has no name',
    ])
  })

  it('lists every camera rule the authored cameras break on its own line', () => {
    expect(productFailureMessage(failures['camera-contract']).split('\n')).toEqual([
      'The authored cameras break the stage camera rules:',
      '- the CAM_home distance 1.2 lies outside',
      '- the minimum distance 0.35 is inside',
    ])
  })

  it.each(Object.values(failures))('carries the facts of a $kind failure', (failure) => {
    const message = productFailureMessage(failure)
    const facts = 'problems' in failure ? failure.problems.map((p) => p.message) : [failure.message]
    for (const fact of facts) {
      expect(message).toContain(fact)
    }
  })

  it('gives every kind its own heading', () => {
    const headings = Object.values(failures).map(
      (failure) => productFailureMessage(failure).split(':')[0],
    )
    expect(new Set(headings).size).toBe(headings.length)
  })
})
