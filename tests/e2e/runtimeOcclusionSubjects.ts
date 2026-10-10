import type { Product } from '../../src/lib/product'
import { registerRuntimeRequirement } from './hotspotTestProducts'
import type { ProductHotspotFacts } from './productHotspots'
import {
  occlusionCandidates,
  selectOcclusionSubjects,
  type OcclusionSubject,
} from './occlusionSubjects'

// Exact subjects require mesh searches. Collection registers by bounds;
// the hook resolves the subjects once in each worker before any proof runs.
export function runtimeOcclusionSubjects(
  products: readonly Product[],
  factsBySlug: ReadonlyMap<string, ProductHotspotFacts>,
): () => ReadonlyMap<string, OcclusionSubject> {
  let subjects: ReadonlyMap<string, OcclusionSubject> | undefined
  const read = () => {
    subjects ??= selectOcclusionSubjects(products, factsBySlug)
    return subjects
  }
  registerRuntimeRequirement(
    'occlusion proof: requires an anchor inside the body',
    occlusionCandidates(products, factsBySlug).size,
    () => {
      read()
    },
  )
  return read
}
