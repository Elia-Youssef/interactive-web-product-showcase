import type { Product, ProductFailure } from '@lib/product'
import { buildCameraPlan, type CameraPlan } from '../camera/productPlan'
import type { ModelFrame } from '../modelFrame'
import { parseProductRig } from '../rig/parseProductRig'
import type { ProductRig } from '../rig/productRig'
import { readFinishResolution, type ProductFinishMaterials } from './finishMaterials'
import type { LoadedModel, ProductModelLoad } from './productModelLoads'

// The steps of the product path whose failures the path anticipates, as
// pure outcomes: each step hands back what the next step needs, or the
// typed failure the product's channel reports. Nothing here throws for a
// failure a model or a manifest can cause, so no anticipated failure ever
// reaches a render as a throw.

// A loaded model opened against its manifest: the model, its parsed rig and
// the finish materials the load resolved, or the failure of the load, of
// the contract the rig is parsed against, or of the finish mappings.
export type OpenedProduct =
  | {
      readonly kind: 'opened'
      readonly model: LoadedModel
      readonly rig: ProductRig
      readonly finishes: ProductFinishMaterials
    }
  | { readonly kind: 'failed'; readonly failure: ProductFailure }

export function openProduct(load: ProductModelLoad, manifest: Product): OpenedProduct {
  if (load.kind === 'failed') {
    return load
  }
  const { model } = load
  const parse = parseProductRig(
    { scene: model.scene, animations: model.animations, json: model.parser.json },
    manifest,
  )
  if (parse.kind === 'broken') {
    return { kind: 'failed', failure: { kind: 'model-contract', problems: parse.problems } }
  }
  const finish = readFinishResolution(model.userData)
  if (finish.kind === 'broken') {
    return { kind: 'failed', failure: { kind: 'finish-contract', problems: finish.problems } }
  }
  return { kind: 'opened', model, rig: parse.rig, finishes: finish.finishes }
}

// The camera plan the presentation shows, or the camera contract failure
// that names every rule the authored cameras break.
export type PlannedPresentation =
  | { readonly kind: 'planned'; readonly plan: CameraPlan }
  | { readonly kind: 'failed'; readonly failure: ProductFailure }

export function planPresentation(
  rig: ProductRig,
  manifest: Product,
  frame: ModelFrame,
): PlannedPresentation {
  const build = buildCameraPlan(rig, manifest, frame)
  if (build.kind === 'broken') {
    return { kind: 'failed', failure: { kind: 'camera-contract', problems: build.problems } }
  }
  return build
}
