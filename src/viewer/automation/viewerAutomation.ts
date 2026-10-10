import type { ProductFailure, ProductRigSummary } from '@lib/product'
import type { RendererBackend } from '@lib/renderer/backend'
import { selectRendererBackend, type ProductStatus, type RendererStatus } from '@store/index'
import type { OverlayPlacement } from '../overlay/StageOverlay'
import type { ViewerModel } from './viewerAutomation.logic'
import type { CameraCompletionRead } from '@lib/camera/requestCompletion'
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
  completion: CameraCompletionRead
  look: ViewerLook
  camera: ViewerCameraAutomation
  finish: ViewerFinish
  hotspots: ViewerHotspotsAutomation
  overlay: ViewerOverlay
  explode: ViewerExplode
  loads: ViewerLoads
  memory: ViewerRendererMemory
}

export type StageProbeKey = keyof StageProbeReads

// One hotspot of the stage's product, as the automation reports it: the
// manifest id, the world position of its anchor read from the HS_ node, and
// the world extent of its subject, the part the anchor rides on, both read
// at access time, so they are wherever the nodes stand now, motion included.
export type ViewerHotspotAutomation = {
  readonly id: string
  readonly position: ViewerVector3
  readonly subject: {
    readonly min: ViewerVector3
    readonly max: ViewerVector3
  }
}

// The hotspots of the product on the stage: the product slug and, per
// hotspot in manifest order, its id, its anchor's live world position and
// its subject's live world extent. The DOM markers are the visible truth;
// this probe gives only what a test cannot read from the page: where each
// anchor and its subject really stand in the scene.
export type ViewerHotspotsAutomation = {
  readonly product: string
  readonly hotspots: readonly ViewerHotspotAutomation[]
}

// The overlay channel of the stage's current canvas life: every key the
// canvas side has written a placement for, with that placement, read from
// the channel at access time. Only a presented frame's post-present phase
// writes placements, and a fresh canvas life starts a fresh channel, so a
// key here was placed by a frame the current canvas presented. The DOM
// markers are the visible truth; this probe shows what the channel holds
// while no marker is mounted to show it.
export type ViewerOverlay = {
  readonly placements: Readonly<Record<string, OverlayPlacement>>
}

// The finish a product on the stage carries: the applied variant name and,
// per mapped mesh primitive, the material name the mesh carries. The
// record is keyed by the file's own tables ('<mesh>:<primitive>'), the
// identity an e2e can derive from the shipped model, not by the names the
// loader renames. The stage's finish probe reads it live from the scene
// graph at access time, so it is what the model really shows, never the
// store selection that was supposed to cause it. The applied variant is
// derived from the meshes too: the one variant whose plan materials every
// mapped mesh carries, or null while the meshes match no single variant.
// The selection the applier is moving to rides beside it as requested, so
// a wait that needs the intent can name it without confusing the two.
export type ViewerFinish = {
  readonly product: string
  readonly applied: string | null
  readonly requested: string
  readonly materials: Readonly<Record<string, string>>
}

// The local position of one PART_ node, as the scene graph holds it.
export type ViewerExplodePart = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// The exploded view's live reading, served by the mounted explode feature:
// the spring's progress, the target it moves toward, whether the motion is
// still running, and every PART_ node's local position read from the scene
// graph itself.
export type ViewerExplode = {
  readonly t: number
  readonly target: number
  readonly moving: boolean
  readonly parts: Readonly<Record<string, ViewerExplodePart>>
}

// The model loads of the stage's renderer: the model URL of every live
// load, the model files read ahead, and how many loads the stage has
// released while they were still running, whose resources are released the
// moment each settles. Read from the stage's loads at access time.
export type ViewerLoads = {
  readonly models: readonly string[]
  readonly bytes: readonly string[]
  readonly settling: number
}

// The live renderer's own memory counters: the geometries, attributes,
// index attributes and textures it holds on the GPU right now, each with
// the bytes it counts for them, plus the entries of the WebGL2 fallback's
// vertex array cache, the one resource class those counters do not count.
// Read from the renderer at access time; the cache reads null where the
// renderer runs on WebGPU and has none.
export type ViewerRendererMemory = {
  readonly geometries: number
  readonly textures: number
  readonly textureBytes: number
  readonly attributes: number
  readonly attributeBytes: number
  readonly indexAttributes: number
  readonly indexAttributeBytes: number
  readonly vaoCache: number | null
}

// The probe-backed fields of the automation: one entry per stage probe key,
// null while no component holds the key. The mapped type is derived from
// StageProbeReads, so a key the stage gains appears here and as a getter in
// the automation object below, or the typecheck fails: a key without a
// getter, or a getter without a key, fails the compile.
export type ViewerAutomationProbeFields = {
  readonly [K in StageProbeKey]: StageProbeReads[K] | null
}

// The stage-owned and store-backed fields, plus one probe-backed field per
// key of StageProbeReads.
export type ViewerAutomation = {
  readonly status: RendererStatus['kind']
  readonly backend: RendererBackend | null
  // True while the store's status is ready, which the stage sets after the
  // first frame it presented.
  readonly ready: boolean
  readonly failure: string | null
  // The product channel: the status kind, the slug it is about, the typed
  // failure (its kind and facts) when it failed, and the plain rig summary
  // once it is ready.
  readonly product: ProductStatus['kind']
  readonly productSlug: string | null
  readonly productFailure: ProductFailure | null
  readonly rig: ProductRigSummary | null
  // How many frames the stage's clock has recorded so far.
  readonly renderedFrames: number
  // The live tone mapping of the renderer, or null while there is none.
  readonly toneMapping: number | null
  // The product the stage has presented, or null while there is none.
  readonly model: ViewerModel | null
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
}

export function createViewerAutomation(sources: ViewerAutomationSources): ViewerAutomation {
  return new StageViewerAutomation(sources)
}

// The automation object: one getter per field of the contract, each reading
// its source at access time. The implements clause is the completeness
// check: a field the contract gains, a probe key included, without a getter
// here fails the typecheck. The sources sit in a private field, so the
// contract exposes the getters and nothing else, and the instance is frozen
// once built.
class StageViewerAutomation implements ViewerAutomation {
  readonly #sources: ViewerAutomationSources

  constructor(sources: ViewerAutomationSources) {
    this.#sources = sources
    Object.freeze(this)
  }

  get status(): RendererStatus['kind'] {
    return this.#sources.getStatus().kind
  }

  get backend(): RendererBackend | null {
    return selectRendererBackend({ rendererStatus: this.#sources.getStatus() })
  }

  get ready(): boolean {
    return this.#sources.getStatus().kind === 'ready'
  }

  get failure(): string | null {
    return rendererFailureOf(this.#sources.getStatus())
  }

  get product(): ProductStatus['kind'] {
    return this.#sources.getProductStatus().kind
  }

  get productSlug(): string | null {
    return productSlugOf(this.#sources.getProductStatus())
  }

  get productFailure(): ProductFailure | null {
    return productFailureOf(this.#sources.getProductStatus())
  }

  get rig(): ProductRigSummary | null {
    return productRigOf(this.#sources.getProductStatus())
  }

  get model(): ViewerModel | null {
    return productModelOf(this.#sources.getProductStatus())
  }

  get renderedFrames(): number {
    return this.#sources.renderedFrames()
  }

  get toneMapping(): number | null {
    return this.#sources.getToneMapping()
  }

  get look(): ViewerLook | null {
    return this.#sources.probes.read('look')
  }

  get camera(): ViewerCameraAutomation | null {
    return this.#sources.probes.read('camera')
  }

  get completion(): CameraCompletionRead | null {
    return this.#sources.probes.read('completion')
  }

  get finish(): ViewerFinish | null {
    return this.#sources.probes.read('finish')
  }

  get hotspots(): ViewerHotspotsAutomation | null {
    return this.#sources.probes.read('hotspots')
  }

  get overlay(): ViewerOverlay | null {
    return this.#sources.probes.read('overlay')
  }

  get explode(): ViewerExplode | null {
    return this.#sources.probes.read('explode')
  }

  get loads(): ViewerLoads | null {
    return this.#sources.probes.read('loads')
  }

  get memory(): ViewerRendererMemory | null {
    return this.#sources.probes.read('memory')
  }
}

declare global {
  interface Window {
    __viewer?: ViewerAutomation
  }
}
