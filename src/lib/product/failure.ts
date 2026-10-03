import type { CameraLimitProblem } from '../camera/limits'
import type { RigProblem } from './rigProblem'
import type { FinishProblem } from './variants'

// Every way a product can fail, as one closed union: the kind says which
// channel failed and the facts say what that channel computed. The product
// path hands every failure to the store as one of these values, so a
// reader tells a contract breach from a load error or a render error by
// its kind, never by parsing a message. Pure data: the display message is
// derived in the display layer, from these facts.
export type ProductFailure =
  // The model file could not be loaded or parsed.
  | { readonly kind: 'load'; readonly url: string; readonly message: string }
  // The loaded model breaks the Blender contract the rig is parsed against.
  | { readonly kind: 'model-contract'; readonly problems: readonly RigProblem[] }
  // The model's finish mappings (KHR_materials_variants) cannot be read:
  // an unknown variant or material, a malformed table.
  | { readonly kind: 'finish-contract'; readonly problems: readonly FinishProblem[] }
  // The authored cameras break the stage camera rules.
  | { readonly kind: 'camera-contract'; readonly problems: readonly CameraLimitProblem[] }
  // The stage settle that presents the product rejected.
  | { readonly kind: 'presentation'; readonly message: string }
  // A presented frame threw while the product was on the stage.
  | { readonly kind: 'render'; readonly message: string }
  // A programming error the product's boundary caught: nothing the product
  // path anticipates reaches this kind.
  | { readonly kind: 'unexpected'; readonly message: string }

export type ProductFailureKind = ProductFailure['kind']
