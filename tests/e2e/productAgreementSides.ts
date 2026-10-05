// The runtime side of the agreement proof and the camera blocks it runs
// both sides under: the loaded product taken down the product path in the
// app's order, the plan built over it, and the blocks that bracket each
// view of a product by the rule they must raise.
import { Object3D } from 'three'
import type { ProductCameraFacts } from './productCamera'
import type { ParsedProduct } from './productGltf'
import type { Product } from '../../src/lib/product/index.ts'
import { farthestPointFrom, type FrameSpan } from '../../src/lib/camera/frame.ts'
import type { CameraLimitProblem } from '../../src/lib/camera/limits.ts'
import { createExplodePose } from '../../src/features/explode/explodePose'
import { measureModelFrame, type ModelFrame } from '../../src/viewer/modelFrame'
import { buildCameraPlan, type CameraPlan } from '../../src/viewer/camera/productPlan'
import { parseProductRig } from '../../src/viewer/rig/parseProductRig'
import type { ProductRig } from '../../src/viewer/rig/productRig'

// The loaded product as the plan sees it, in the app's order: the frame
// measured and the rig parsed on the fresh scene (PresentedProduct and
// openProduct), the scene mounted under the centering group
// (PresentedProduct), then posed at the explode clip's first frame (the
// explode driver's layout effect, which runs before the plan's effect).
export function presentedProduct(
  parsed: ParsedProduct,
  manifest: Product,
): { readonly rig: ProductRig; readonly frame: ModelFrame } {
  const frame = measureModelFrame(parsed.scene)
  const parse = parseProductRig(
    { scene: parsed.scene, animations: parsed.animations, json: parsed.json },
    manifest,
  )
  if (parse.kind === 'broken') {
    throw new Error(`the shipped rig must parse, it broke with: ${JSON.stringify(parse.problems)}`)
  }
  const group = new Object3D()
  group.position.set(-frame.centerX, -frame.centerY, -frame.centerZ)
  group.add(parsed.scene)
  createExplodePose(parsed.scene, parse.rig.clip).apply(0)
  return { rig: parse.rig, frame }
}

// The plan the runtime builds for a manifest the case expects to hold.
export function plannedCamera(rig: ProductRig, manifest: Product, frame: ModelFrame): CameraPlan {
  const build = buildCameraPlan(rig, manifest, frame)
  if (build.kind === 'broken') {
    throw new Error(`the shipped plan must build, it broke with: ${JSON.stringify(build.problems)}`)
  }
  return build.plan
}

// The problems a plan build reports for the given camera block, or null
// when the plan builds.
export function planProblems(
  rig: ProductRig,
  manifest: Product,
  frame: ModelFrame,
): readonly CameraLimitProblem[] | null {
  const build = buildCameraPlan(rig, manifest, frame)
  return build.kind === 'broken' ? build.problems : null
}

// The camera blocks that bracket a product's views, each with the problem
// it must raise: for the home view a minimum just above its distance and a
// maximum just below it, for each close-up a minimum just above its
// distance, the limit a close-up nears, and one minimum between the model's
// radius and the farthest reach of any view, which clears the model around
// its center but not around that view's target, so only the reach rule
// over that view can catch it.
export function bracketsOf(facts: ProductCameraFacts, frame: FrameSpan) {
  const home = facts.home.distance
  const views = [['home', facts.home] as const, ...facts.closeUps]
  const reaches = views.map(([id, view]) => ({
    id,
    reach: farthestPointFrom(facts.stageBounds, view.target),
  }))
  const farthest = reaches.reduce((best, next) => (next.reach > best.reach ? next : best))
  if (!(farthest.reach > frame.radius)) {
    throw new Error('no view of the product reaches beyond the model radius to bracket')
  }
  return [
    {
      expected: 'the CAM_home distance',
      block: { minDistance: home * (1 + 1e-6), maxDistance: home * 4 },
    },
    {
      expected: 'the CAM_home distance',
      block: { minDistance: home * 0.1, maxDistance: home * (1 - 1e-6) },
    },
    ...[...facts.closeUps].map(([id, view]) => ({
      expected: `the CAM_${id} distance`,
      block: { minDistance: view.distance * (1 + 1e-6) },
    })),
    {
      expected: `CAM_${farthest.id} minimum distance`,
      block: { minDistance: (frame.radius + farthest.reach) / 2 },
    },
  ]
}
