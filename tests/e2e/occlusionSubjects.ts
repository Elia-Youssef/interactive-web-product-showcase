import type { Product } from '../../src/lib/product'
import { factsBoundsOf, isInsideBox, pointOf, type Point3 } from './hotspotPlacement'
import type { ProductHotspotFact, ProductHotspotFacts } from './productHotspots'

// The subjects of the marker occlusion proof, selected from the product
// set: per product, its occlusion subject, an anchor inside the occluding
// meshes' bounds whose facts carry a hiding height, or none, because no
// product is required to offer one. Every inside anchor is considered, not
// only the first, so a product whose first anchor has no hiding height
// still proves the occlusion through another. The selection is pure: the
// products and their hotspot facts in, the subjects out. The set-level
// guard fails at collection when the whole set offers no subject, naming
// what is missing, so the proof never disappears silently with the
// products it was written to drive.

// One product's occlusion subject: the manifest hotspot whose anchor the
// body can hide, the anchor's position in stage space, and the camera
// height the facts found, from which the anchor's opposite-azimuth ray is
// blocked while every other anchor's ray stays clear.
export type OcclusionSubject = {
  readonly product: Product
  readonly hotspot: Product['hotspots'][number]
  readonly anchor: Point3
  readonly hidingHeightM: number
}

// Selects the occlusion proof's subjects over the whole product set, by
// slug. A product without facts fails loudly; a product without a subject
// is simply not a subject of the proof and answers no entry. Fails at
// collection, naming what is missing, when no product of the set offers a
// subject: the hiding tests each need at least one product that has what
// they drive, wherever in the set it sits.
export function selectOcclusionSubjects(
  products: readonly Product[],
  factsBySlug: ReadonlyMap<string, ProductHotspotFacts>,
): ReadonlyMap<string, OcclusionSubject> {
  const subjects = new Map<string, OcclusionSubject>()
  for (const product of products) {
    const facts = factsBySlug.get(product.slug)
    if (facts === undefined) {
      throw new Error(`no hotspot facts for ${product.slug}`)
    }
    const subject = subjectOf(product, facts)
    if (subject !== null) {
      subjects.set(product.slug, subject)
    }
  }
  if (subjects.size === 0) {
    throw new Error(
      'the product set carries no occludable hotspot with a hiding height for the occlusion proof',
    )
  }
  return subjects
}

// The product's first anchor, in manifest order, that lies inside the
// occluder bounds with a hiding height, or null when none does.
function subjectOf(product: Product, facts: ProductHotspotFacts): OcclusionSubject | null {
  const bounds = factsBoundsOf(facts)
  const fact = facts.hotspots.find((candidate) => isHidable(candidate, bounds))
  if (fact === undefined) {
    return null
  }
  const hotspot = product.hotspots.find((entry) => entry.id === fact.id)
  if (hotspot === undefined) {
    throw new Error(`no manifest hotspot '${fact.id}' in ${product.slug}`)
  }
  return {
    product,
    hotspot,
    anchor: pointOf(fact.stagePosition),
    hidingHeightM: fact.hidingHeightM,
  }
}

// Whether the anchor lies inside the occluder bounds and the facts found a
// hiding height for it: the two halves of the subject rule.
function isHidable(
  fact: ProductHotspotFact,
  bounds: { readonly min: Point3; readonly max: Point3 },
): fact is ProductHotspotFact & { readonly hidingHeightM: number } {
  return fact.hidingHeightM !== null && isInsideBox(pointOf(fact.stagePosition), bounds)
}

// The card follow proof needs one product that has both halves of it: a
// plain hotspot whose open card follows its marker, and an occlusion
// subject that hides behind the body. Answers the slugs that carry both and
// fails at collection, naming what is missing, when none does, so the
// follow proof never disappears silently when the product that carried it
// leaves the set.
export function requireFollowSubjects(
  products: readonly { readonly slug: string; readonly hasPlainHotspot: boolean }[],
  subjects: ReadonlyMap<string, OcclusionSubject>,
): ReadonlySet<string> {
  const slugs = new Set(
    products
      .filter((product) => product.hasPlainHotspot && subjects.has(product.slug))
      .map((product) => product.slug),
  )
  if (slugs.size === 0) {
    throw new Error(
      'the product set carries no product with both a plain hotspot and an occlusion subject for the card follow proof',
    )
  }
  return slugs
}
