// The agreement proof: for every shipped product, the frame and the camera
// facts the build-time validate step reads from the document equal,
// exactly, what the runtime code measures when the model loads through
// three's real GLTFLoader, and both sides fail on the same problems, by the
// same messages, under both rule sets of the camera contract: the limit
// rules (camera blocks that bracket each view) and the view geometry rule
// (each view bent to a degenerate field of view). The loader side parses
// the .glb itself (productGltf.ts), so the proof exercises the runtime's
// loader path and cannot agree with the document facts by construction;
// the drifts only the real loader can see live in productGltfDrift.test.ts.
import { describe, expect, it } from 'vitest'
import { MathUtils, Object3D, PerspectiveCamera, Vector3 } from 'three'
import { fileURLToPath } from 'node:url'
import { productCameraFactsOf, type ProductCameraFacts } from './productCamera'
import { parseDocumentWithLoader, parseShippedGltf } from './productGltf'
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
import { checkCameras, contractViews } from '../../scripts/validateCameras.ts'
import { readProductStructure } from '../../scripts/structure.ts'
import { cameraContract } from '../../scripts/validateFixtures.ts'
import type { CameraLimitProblem } from '../../src/lib/camera/limits.ts'
import type { CameraPlan } from '../../src/viewer/camera/productPlan'
import type { ModelFrame } from '../../src/viewer/modelFrame'
import type { ProductRig } from '../../src/viewer/rig/productRig'
import type { Document, Node } from '@gltf-transform/core'

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

// The first node of the document by the name, the one the contract and the
// rig read for a camera name.
function firstNodeNamed(doc: Document, name: string): Node {
  const node = doc
    .getRoot()
    .listNodes()
    .find((candidate) => candidate.getName() === name)
  if (node === undefined) {
    throw new Error(`the document holds no node ${name}`)
  }
  return node
}

// The distance between a view's position and target, the orbit distance
// the facts carry.
function orbitDistance(view: {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
}): number {
  return Math.sqrt(
    (view.position[0] - view.target[0]) ** 2 +
      (view.position[1] - view.target[1]) ** 2 +
      (view.position[2] - view.target[2]) ** 2,
  )
}

// The camera blocks that bracket a product's views by one relative step:
// for the home view a minimum just above its distance and a maximum just
// below it, and for each close-up a minimum just above its distance, the
// limit a close-up nears. Each names the view it puts outside the limits.
function bracketsOf(facts: ProductCameraFacts) {
  const home = facts.home.distance
  return [
    { name: 'CAM_home', block: { minDistance: home * (1 + 1e-6), maxDistance: home * 4 } },
    { name: 'CAM_home', block: { minDistance: home * 0.1, maxDistance: home * (1 - 1e-6) } },
    ...[...facts.closeUps].map(([id, view]) => ({
      name: `CAM_${id}`,
      block: { minDistance: view.distance * (1 + 1e-6) },
    })),
  ]
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

  it.each(SHIPPED_SLUGS)('builds the same views and limits for %s', async (slug) => {
    const modelPath = `public/models/${slug}/model.glb`
    const { doc, frame: documentFrame } = await shippedDocument(slug)
    const facts = productCameraFactsOf(doc, modelPath)
    const { manifest } = await shippedManifest(slug)
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
    // facts: the stage's origin as the center, the stage-space rays. Every
    // view the plan presents is a view the facts carry, by the same id, and
    // the view set is the one validate checks.
    const frame = planFrame(documentFrame)
    const rig = centeredRig(parsed, manifest, frame)
    const plan = plannedCamera(rig, manifest, frame)
    const structure = readProductStructure(doc)
    expect([...plan.views.keys()]).toEqual(
      contractViews(manifest, structure).map((view) => view.id),
    )
    for (const [id, view] of plan.views) {
      const expected = id === 'home' ? facts.home : facts.closeUps.get(id)
      if (expected === undefined) {
        throw new Error(`the plan of ${slug} presents a view ${id} the facts do not carry`)
      }
      expect(view.position).toEqual(expected.position)
      expect(view.target).toEqual(expected.target)
      expect(view.near).toBe(expected.near)
      expect(view.far).toBe(expected.far)
      expect(orbitDistance(view)).toBe(expected.distance)
    }
    expect(plan.authoredAspect).toBe(facts.home.aspect)
    expect(plan.baseFovY).toBe(facts.home.fovY)
    // The limits the plan presents: each side the manifest authors, else
    // the ratio of the same home distance the facts carry.
    expect(plan.distanceRange.min).toBe(
      manifest.camera?.minDistance ?? facts.home.distance * cameraLimitConfig.minHomeDistanceRatio,
    )
    expect(plan.distanceRange.max).toBe(
      manifest.camera?.maxDistance ?? facts.home.distance * cameraLimitConfig.maxHomeDistanceRatio,
    )
    expect(plan.polarRange.min).toBe((cameraLimitConfig.minPolarAngleDegrees * Math.PI) / 180)
    expect(plan.polarRange.max).toBe((cameraLimitConfig.maxPolarAngleDegrees * Math.PI) / 180)

    // The shipped manifest holds on both sides.
    expect(checkCameras(manifest, structure, cameraContract).violations).toEqual([])
  })

  it.each(SHIPPED_SLUGS)('fails on the same problems for %s on both sides', async (slug) => {
    const { doc, frame: documentFrame } = await shippedDocument(slug)
    const facts = productCameraFactsOf(doc, `public/models/${slug}/model.glb`)
    const { manifest, input } = await shippedManifest(slug)
    const frame = planFrame(documentFrame)
    const rig = centeredRig(await parseShippedGltf(slug), manifest, frame)
    const structure = readProductStructure(doc)

    // Camera blocks that bracket a view's distance: validate and the
    // runtime fail on the same problems, by the same values, in the same
    // order. The manifest input parses again with the block, so both sides
    // see the real schema output.
    const manifestWith = (camera: { minDistance?: number; maxDistance?: number }): Product =>
      parseProduct({ ...(input as Record<string, unknown>), camera }, `the ${slug} fixture`)
    for (const bracket of bracketsOf(facts)) {
      const validateViolations = checkCameras(
        manifestWith(bracket.block),
        structure,
        cameraContract,
      ).violations
      const problems = planProblems(rig, manifestWith(bracket.block), frame)
      if (problems === null) {
        throw new Error(`the plan built under the ${bracket.name} bracket of ${slug}`)
      }
      const messages = problems.map((problem) => problem.message)
      expect(validateViolations).toEqual(messages)
      // The bracket hits the view it brackets, so the agreement covers that
      // view's own rule, not only a problem some other view raises.
      expect(messages).toContainEqual(expect.stringContaining(`the ${bracket.name} distance`))
    }
  })

  it.each(SHIPPED_SLUGS)(
    'fails on the same geometry problems for %s on both sides, view by view',
    async (slug) => {
      const { manifest } = await shippedManifest(slug)
      const { doc: shipped } = await shippedDocument(slug)
      const ids = contractViews(manifest, readProductStructure(shipped)).map((view) => view.id)
      // One view at a time takes a degenerate field of view in the shipped
      // document, which both sides then read: validate from the document,
      // the runtime from the real loader's parse of the same document. The
      // geometry rule names that view on both sides, by the same message,
      // and the rules every other view answers to still agree beside it.
      for (const id of ids) {
        const { doc, frame: documentFrame } = await shippedDocument(slug)
        const camera = firstNodeNamed(doc, `CAM_${id}`).getCamera()
        if (camera === null) {
          throw new Error(`the CAM_${id} node of ${slug} carries no camera`)
        }
        camera.setYFov(0)
        const validateViolations = checkCameras(
          manifest,
          readProductStructure(doc),
          cameraContract,
        ).violations
        const frame = planFrame(documentFrame)
        const rig = centeredRig(await parseDocumentWithLoader(doc), manifest, frame)
        const problems = planProblems(rig, manifest, frame)
        if (problems === null) {
          throw new Error(`the plan of ${slug} built with a degenerate CAM_${id}`)
        }
        const messages = problems.map((problem) => problem.message)
        expect(validateViolations).toEqual(messages)
        expect(messages).toContain(
          `the camera CAM_${id} has a field of view of 0 rad, outside the open range (0, ${Math.PI})`,
        )
      }
    },
  )

  it('brackets a close-up view on the shipped set', async () => {
    // The close-up brackets above run only for a product whose model
    // carries a close-up; without one in the set the every-view agreement
    // would pass on the home view alone.
    let closeUps = 0
    for (const slug of SHIPPED_SLUGS) {
      const { doc } = await shippedDocument(slug)
      closeUps += productCameraFactsOf(doc, `public/models/${slug}/model.glb`).closeUps.size
    }
    expect(closeUps).toBeGreaterThan(0)
  })
})
