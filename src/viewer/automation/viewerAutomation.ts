import type { ProductRigSummary } from '@lib/product'
import type { RendererBackend } from '@lib/renderer/backend'
import { selectRendererBackend, type ProductStatus, type RendererStatus } from '@store/index'
import type { ViewerModel } from './viewerAutomation.logic'
import {
  productFailureOf,
  productModelOf,
  productRigOf,
  productSlugOf,
  rendererFailureOf,
} from './viewerAutomation.logic'

// The test contract of the viewer, installed as window.__viewer in every
// build. Every field is a getter: the renderer fields are read from the
// store at access time, the product fields the same way, the frame field
// from the stage's frame clock, and the probe fields from the stage's
// probes, so the hook holds no copies that can go stale.

// The model a stage has presented, exactly as the automation hook reports
// it: the slug plus the counts measured once at load, carried by the
// store's ready status. A non-null model is a presented product, never one
// whose render pipelines may still be pending. The type lives beside the
// derivation that produces it and is re-exported here, where the contract
// reads it.
export type { ViewerModel } from './viewerAutomation.logic'

// The applied state of the shadow material, read back from the material
// itself: the opacity the look left on it and the flags its compositing
// depends on.
export type ViewerLookShadow = {
  readonly opacity: number
  readonly transparent: boolean
  readonly depthWrite: boolean
}

// One loaded texture as the color management check reads it: the material
// that carries it, the material slot it sits in, and the color space the
// loader left on it.
export type ViewerLookTexture = {
  readonly material: string
  readonly slot: string
  readonly colorSpace: string
}

// The look of the stage, read back from the renderer, the scene and the
// shadow material at access time. Null while no product's look has ever been
// applied on this stage; the shadow and texture fields are null while no
// product is mounted, so the getter still proves the restore of the renderer
// and scene values after the product leaves.
export type ViewerLook = {
  readonly exposure: number
  readonly environmentIntensity: number
  readonly environmentRotationDeg: number
  readonly shadow: ViewerLookShadow | null
  readonly textures: readonly ViewerLookTexture[] | null
}
// One point of the stage camera, read at access time.
export type ViewerVector3 = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// The live stage camera: its world position, its orbit target and its
// vertical fov, plus the readouts the controls hold. Every value is read
// from the camera and the controls themselves at access time, never from
// the store's copy of the readouts. Null while no stage camera owns the
// view.
export type ViewerCameraAutomation = {
  readonly position: ViewerVector3
  readonly target: ViewerVector3
  readonly fovY: number
  readonly azimuth: number
  readonly polar: number
  readonly distance: number
  readonly minDistance: number
  readonly maxDistance: number
}

// The probe keys of the stage and the value each answers with, one entry
// per automation channel read from inside the canvas. A new channel adds
// its key here; the automation's probe fields below are this
// table as a mapped type, so the table and the fields cannot drift apart.
export type StageProbeReads = {
  look: ViewerLook
  camera: ViewerCameraAutomation
}

export type StageProbeKey = keyof StageProbeReads

// The finish a product on the stage carries, as the variants controller
// read it from the scene graph after the settle that applied it: the
// applied variant name and, per mapped mesh primitive, the material name
// the mesh carries. The record is keyed by the file's own tables
// ('<mesh>:<primitive>'), the identity an e2e can derive from the shipped
// model, not by the names the loader renames.
export type ViewerFinish = {
  readonly product: string
  readonly applied: string
  readonly materials: Readonly<Record<string, string>>
}

// The slot the variants controller publishes the applied-finish record to,
// and the automation's finish source reads it from. The controller is the
// one writer (per settled application, cleared when it unmounts), the
// automation the one reader, and the read is the post-settle scene graph
// itself, not the store selection that was supposed to cause it.
export function publishViewerFinish(finish: ViewerFinish | null): void {
  if (finish === null) {
    delete window.__viewerFinish
    return
  }
  window.__viewerFinish = finish
}

export function readViewerFinish(): ViewerFinish | null {
  const carried: unknown = window.__viewerFinish
  return isViewerFinish(carried) ? carried : null
}

function isViewerFinish(value: unknown): value is ViewerFinish {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const materials: unknown = Reflect.get(value, 'materials')
  if (typeof materials !== 'object' || materials === null) {
    return false
  }
  return (
    typeof Reflect.get(value, 'product') === 'string' &&
    typeof Reflect.get(value, 'applied') === 'string' &&
    Object.values(materials).every((name) => typeof name === 'string')
  )
}

// The probe-backed fields of the automation: one entry per stage probe key,
// null while no component holds the key. The mapped type is derived from
// StageProbeReads, so a key the stage gains appears here and in the
// automation object below, or the typecheck fails.
export type ViewerAutomationProbeFields = {
  readonly [K in StageProbeKey]: StageProbeReads[K] | null
}

// The stage-owned and store-backed fields, plus the finish the finishes
// controller publishes to its slot. The finish reads through its current
// source here; moving it onto a probe key is that key's entry in
// StageProbeReads, a registration in the controller, and nothing else.
export type ViewerAutomation = {
  readonly status: RendererStatus['kind']
  readonly backend: RendererBackend | null
  // True while the store's status is ready, which the stage sets after the
  // first frame its observer saw actually rendered.
  readonly ready: boolean
  readonly failure: string | null
  // The product channel: the status kind, the slug it is about, the reason
  // when it failed, and the plain rig summary once it is ready.
  readonly product: ProductStatus['kind']
  readonly productSlug: string | null
  readonly productFailure: string | null
  readonly rig: ProductRigSummary | null
  // How many frames the stage's clock has recorded so far.
  readonly renderedFrames: number
  // The live tone mapping of the renderer, or null while there is none.
  readonly toneMapping: number | null
  // The product the stage has presented, or null while there is none.
  readonly model: ViewerModel | null
  // The finish the presented product carries, or null while nothing is
  // applied.
  readonly finish: ViewerFinish | null
} & ViewerAutomationProbeFields

export type ViewerAutomationSources = {
  // The stage's probes, read at access time; the structural read is all
  // the automation needs of the probes object.
  readonly probes: {
    readonly read: <K extends StageProbeKey>(key: K) => StageProbeReads[K] | null
  }
  // The renderer status exactly as the store holds it right now.
  readonly getStatus: () => RendererStatus
  // The product status exactly as the store holds it right now.
  readonly getProductStatus: () => ProductStatus
  readonly renderedFrames: () => number
  readonly getToneMapping: () => number | null
  // The applied finish exactly as the scene graph carries it right now.
  readonly getFinish: () => ViewerFinish | null
}

export function createViewerAutomation(sources: ViewerAutomationSources): ViewerAutomation {
  const rendererStatus = () => sources.getStatus()
  const productStatus = () => sources.getProductStatus()
  return Object.freeze({
    get status(): RendererStatus['kind'] {
      return rendererStatus().kind
    },
    get backend(): RendererBackend | null {
      return selectRendererBackend({ rendererStatus: rendererStatus() })
    },
    get ready(): boolean {
      return rendererStatus().kind === 'ready'
    },
    get failure(): string | null {
      return rendererFailureOf(rendererStatus())
    },
    get product(): ProductStatus['kind'] {
      return productStatus().kind
    },
    get productSlug(): string | null {
      return productSlugOf(productStatus())
    },
    get productFailure(): string | null {
      return productFailureOf(productStatus())
    },
    get rig(): ProductRigSummary | null {
      return productRigOf(productStatus())
    },
    get model(): ViewerModel | null {
      return productModelOf(productStatus())
    },
    get renderedFrames(): number {
      return sources.renderedFrames()
    },
    get toneMapping(): number | null {
      return sources.getToneMapping()
    },
    // The probe-backed fields, one getter per key of StageProbeReads, each
    // read live through the stage's probes. The type above is the mapped
    // StageProbeReads, so the typecheck holds this object to the table: a
    // key without a getter, or a getter without a key, fails the compile.
    get look(): ViewerLook | null {
      return sources.probes.read('look')
    },
    get camera(): ViewerCameraAutomation | null {
      return sources.probes.read('camera')
    },
    get finish(): ViewerFinish | null {
      return sources.getFinish()
    },
  })
}

declare global {
  interface Window {
    __viewer?: ViewerAutomation
    // The applied-finish slot between the variants controller and the
    // automation's finish source, typed unknown and read through a guard,
    // so a foreign or stale value reads as no finish instead of lying.
    __viewerFinish?: unknown
  }
}
