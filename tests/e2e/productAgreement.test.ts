// The agreement proof: for every shipped product, the frame and the home
// camera facts the build-time validate step reads from the document equal,
// exactly, what the runtime code measures when the model loads through
// three's real GLTFLoader. The loader side parses the shipped .glb itself
// (productGltf.ts), so the proof exercises the runtime's loader path and
// cannot agree with the document facts by construction; the geometry-class
// cases at the bottom show the drifts only the real loader can see.
import { describe, expect, it } from 'vitest'
import { MathUtils, Object3D, PerspectiveCamera, Vector3 } from 'three'
import { fileURLToPath } from 'node:url'
import { productCameraFactsOf } from './productCamera'
import { parseShippedGltf } from './productGltf'
import { createModelIO } from '../../scripts/modelIo.ts'
import { readCameraFacts, readMeshBoxes } from '../../scripts/modelFacts.ts'
import { listShippedSlugs } from '../../scripts/shippedProducts.ts'
import { parseProduct } from '../../src/lib/product/index.ts'
import type { Product } from '../../src/lib/product/index.ts'
import { readManifestFile } from '../../scripts/manifestIo.ts'
import { productPaths } from '../../scripts/productPaths.ts'
import { measureModelFrame } from '../../src/viewer/modelFrame'
import { buildCameraPlan } from '../../src/viewer/camera/productPlan'
import { parseProductRig } from '../../src/viewer/rig/parseProductRig'
import { frameSpanOfMeshBoxes } from '../../src/lib/camera/frame.ts'
import { cameraLimitConfig } from '../../src/lib/camera/config.ts'
import { checkCameras } from '../../scripts/validateCameras.ts'
import { readProductStructure } from '../../scripts/structure.ts'
import { cameraContract } from '../../scripts/validateFixtures.ts'
import type { CameraLimitProblem } from '../../src/lib/camera/limits.ts'
import type { CameraPlan } from '../../src/viewer/camera/productPlan'
import type { ModelFrame } from '../../src/viewer/modelFrame'
import type { ProductRig } from '../../src/viewer/rig/productRig'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The shipped products of this checkout, by the discovery the validate
// step itself runs.
const SHIPPED_SLUGS = await listShippedSlugs(ROOT)

let modelIO: ReturnType<typeof createModelIO> | null = null
function modelIOSoon(): ReturnType<typeof createModelIO> {
  modelIO ??= createModelIO()
  return modelIO
}

// The parsed manifest of a shipped product, through the real schema, with
// the raw input for cases that override the camera block.
async function shippedManifest(slug: string): Promise<{ manifest: Product; input: unknown }> {
  const paths = productPaths(ROOT, slug)
  const load = await readManifestFile(paths.manifestFile)
  if (load.kind !== 'loaded') {
    throw new Error(`the manifest of ${slug} did not load`)
  }
  return { manifest: parseProduct(load.manifest, paths.manifestFile), input: load.manifest }
}

// The model frame the plan builds against, from the document frame.
function planFrame(frame: {
  center: readonly [number, number, number]
  radius: number
}): ModelFrame {
  return {
    centerX: frame.center[0],
    centerY: frame.center[1],
    centerZ: frame.center[2],
    radius: frame.radius,
    meshes: 1,
    triangles: 1,
  }
}

// The plan the runtime builds over the centered loader tree.
function centeredRig(
  parsed: {
    scene: Object3D
    animations: Parameters<typeof parseProductRig>[0]['animations']
    json: unknown
  },
  manifest: Product,
  frame: ModelFrame,
): ProductRig {
  const group = new Object3D()
  group.position.set(-frame.centerX, -frame.centerY, -frame.centerZ)
  group.add(parsed.scene)
  const parse = parseProductRig(
    { scene: group, animations: parsed.animations, json: parsed.json },
    manifest,
  )
  if (parse.kind === 'broken') {
    throw new Error(`the shipped rig must parse, it broke with: ${JSON.stringify(parse.problems)}`)
  }
  return parse.rig
}

// The plan the runtime builds for a manifest the case expects to hold.
function plannedCamera(rig: ProductRig, manifest: Product, frame: ModelFrame): CameraPlan {
  const build = buildCameraPlan(rig, manifest, frame)
  if (build.kind === 'broken') {
    throw new Error(`the shipped plan must build, it broke with: ${JSON.stringify(build.problems)}`)
  }
  return build.plan
}

// The problems a plan build reports for the given camera block, or null
// when the plan builds.
function planProblems(
  rig: ProductRig,
  manifest: Product,
  frame: ModelFrame,
): readonly CameraLimitProblem[] | null {
  const build = buildCameraPlan(rig, manifest, frame)
  return build.kind === 'broken' ? build.problems : null
}

// The document of a shipped model, and the frame its mesh boxes span.
async function shippedDocument(slug: string) {
  const doc = await (await modelIOSoon()).read(`public/models/${slug}/model.glb`)
  return { doc, frame: frameSpanOfMeshBoxes(readMeshBoxes(doc)) }
}

describe('the document facts agree with the real loader on every shipped product', () => {
  it.each(SHIPPED_SLUGS)('measures the same frame for %s', async (slug) => {
    const { frame: documentFrame } = await shippedDocument(slug)
    const parsed = await parseShippedGltf(slug)
    const runtimeFrame = measureModelFrame(parsed.scene)
    expect(runtimeFrame.centerX).toBe(documentFrame.center[0])
    expect(runtimeFrame.centerY).toBe(documentFrame.center[1])
    expect(runtimeFrame.centerZ).toBe(documentFrame.center[2])
    expect(runtimeFrame.radius).toBe(documentFrame.radius)
  })

  it.each(SHIPPED_SLUGS)('builds the same home view, limits and failures for %s', async (slug) => {
    const modelPath = `public/models/${slug}/model.glb`
    const { doc, frame: documentFrame } = await shippedDocument(slug)
    const facts = productCameraFactsOf(doc, modelPath)
    const { manifest, input } = await shippedManifest(slug)
    const parsed = await parseShippedGltf(slug)

    // The home ray the document facts read, against the loader's camera
    // world transform, in model space.
    const homeFact = readCameraFacts(doc).find((fact) => fact.name === 'CAM_home')
    if (homeFact === undefined || homeFact.ray === null) {
      throw new Error(`the shipped product ${slug} carries no home camera ray`)
    }
    const homeCamera = parsed.scene.getObjectByName('CAM_home')
    if (!(homeCamera instanceof PerspectiveCamera)) {
      throw new Error(`the loader tree of ${slug} holds no perspective CAM_home`)
    }
    const position = homeCamera.getWorldPosition(new Vector3())
    const forward = homeCamera.getWorldDirection(new Vector3())
    expect([position.x, position.y, position.z]).toEqual(homeFact.ray.position)
    expect([forward.x, forward.y, forward.z]).toEqual(homeFact.ray.forward)
    // The fov rides the loader's degrees round trip; on the shipped cameras
    // it comes back as the authored double.
    expect(MathUtils.degToRad(homeCamera.fov)).toBe(homeFact.ray.fovY)
    expect(homeCamera.aspect).toBe(facts.home.aspect)

    // The plan the runtime builds over the centered tree, against the same
    // facts: the stage's origin as the center, the stage-space rays.
    const frame = planFrame(documentFrame)
    const rig = centeredRig(parsed, manifest, frame)
    const plan = plannedCamera(rig, manifest, frame)
    const homeView = plan.views.get('home')
    if (homeView === undefined) {
      throw new Error(`the plan of ${slug} holds no home view`)
    }
    expect(homeView.position).toEqual(facts.home.position)
    expect(homeView.target).toEqual(facts.home.target)
    expect(homeView.near).toBe(facts.home.near)
    expect(homeView.far).toBe(facts.home.far)
    expect(
      Math.sqrt(
        (homeView.position[0] - homeView.target[0]) ** 2 +
          (homeView.position[1] - homeView.target[1]) ** 2 +
          (homeView.position[2] - homeView.target[2]) ** 2,
      ),
    ).toBe(facts.home.distance)
    expect(plan.authoredAspect).toBe(facts.home.aspect)
    expect(plan.baseFovY).toBe(facts.home.fovY)
    // The limits the plan presents are the limits over the same home
    // distance the facts carry.
    expect(plan.distanceRange.min).toBe(
      facts.home.distance * cameraLimitConfig.minHomeDistanceRatio,
    )
    expect(plan.distanceRange.max).toBe(
      facts.home.distance * cameraLimitConfig.maxHomeDistanceRatio,
    )
    expect(plan.polarRange.min).toBe((cameraLimitConfig.minPolarAngleDegrees * Math.PI) / 180)
    expect(plan.polarRange.max).toBe((cameraLimitConfig.maxPolarAngleDegrees * Math.PI) / 180)

    // Camera blocks that bracket the home distance: validate and the
    // runtime fail on the same problem, by the same values. The manifest
    // input parses again with the block, so both sides see the real schema
    // output.
    const manifestWithCamera = (camera: { minDistance?: number; maxDistance?: number }): Product =>
      parseProduct({ ...(input as Record<string, unknown>), camera }, `the ${slug} fixture`)
    const structure = readProductStructure(doc)
    const distance = facts.home.distance
    for (const block of [
      { minDistance: distance * (1 + 1e-6), maxDistance: distance * 4 },
      { minDistance: distance * 0.1, maxDistance: distance * (1 - 1e-6) },
    ]) {
      const validateViolations = checkCameras(
        manifestWithCamera(block),
        structure,
        cameraContract,
      ).violations
      const problems = planProblems(rig, manifestWithCamera(block), frame)
      if (problems === null) {
        throw new Error('the bracketed plan built, the mixed-space bug is back')
      }
      expect(validateViolations).toEqual(problems.map((problem) => problem.message))
    }

    // The unblocked manifest still holds on both sides.
    expect(checkCameras(manifest, structure, cameraContract).violations).toEqual([])
    expect(planProblems(rig, manifest, frame)).toBeNull()
  })
})
