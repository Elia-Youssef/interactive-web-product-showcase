import type { ProductFailure, ProductFailureKind } from '@lib/product'
import { unknownMappingVariantMessage } from '@lib/product'

// One failure of every kind, keyed by the kind, so the table cannot miss a
// member of the union: a kind the union gains fails the typecheck here
// until it has a row.
export const productFailureFixtures: {
  readonly [K in ProductFailureKind]: Extract<ProductFailure, { kind: K }>
} = {
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
      { mesh: 2, primitive: 0, message: unknownMappingVariantMessage(0, 9, 2) },
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
