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
// The loader side runs the product path in the app's order: the frame is
// measured and the rig parsed on the fresh scene, then the scene is
// centered and posed at the explode clip's first frame, as the explode
// feature poses it before the plan is built, and only then is the plan
// built.
import { describe, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../../tooling/subprocess.fixtures.ts'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { fileURLToPath } from 'node:url'
import { productCameraFactsOf } from './productCamera'
import { parseDocumentWithLoader } from './productGltf'
import { readSharedParsedProduct } from './sharedProductModels'
import { bracketsOf, planProblems, plannedCamera, presentedProduct } from './productAgreementSides'
import { modelPathOf } from '../../scripts/fixtureProducts.ts'
import { createModelIO } from '../../scripts/modelIo.ts'
import { readCameraFacts, readMeshBoxes } from '../../scripts/modelFacts.ts'
import { listShippedSlugs } from '../../scripts/shippedProducts.ts'
import { parseProduct, type Product } from '../../src/lib/product/index.ts'
import {
  CAMERA_HOME_ID,
  CAMERA_HOME_NAME,
  CAMERA_PREFIX,
} from '../../src/lib/product/contractNames.ts'
import { measureModelFrame } from '../../src/viewer/modelFrame'
import { readManifestFile } from '../../scripts/manifestIo.ts'
import { productPaths } from '../../scripts/productPaths.ts'
import { frameSpanOfMeshBoxes } from '../../src/lib/camera/frame.ts'
import { cameraLimitConfig } from '../../src/lib/camera/config.ts'
import { checkCameras, contractViews } from '../../scripts/validateCameras.ts'
import { readProductStructure } from '../../scripts/structure.ts'
import { cameraContract } from '../../scripts/validateFixtures.ts'
import type { Document, Node } from '@gltf-transform/core'
import type { FrameSpan } from '../../src/lib/camera/frame.ts'

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

// The document of a shipped model, and the frame its mesh boxes span.
async function shippedDocument(slug: string): Promise<{ doc: Document; frame: FrameSpan }> {
  const doc = await (await modelIOSoon()).read(await modelPathOf(ROOT, slug))
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

describe(
  'the document facts agree with the real loader on every shipped product',
  { timeout: TOOL_FIXTURE_TIMEOUT_MS },
  () => {
    it.each(SHIPPED_SLUGS)('measures the same frame for %s', async (slug) => {
      const { frame: documentFrame } = await shippedDocument(slug)
      const parsed = await readSharedParsedProduct(await modelPathOf(ROOT, slug))
      const runtimeFrame = measureModelFrame(parsed.scene)
      expect(runtimeFrame.centerX).toBe(documentFrame.center[0])
      expect(runtimeFrame.centerY).toBe(documentFrame.center[1])
      expect(runtimeFrame.centerZ).toBe(documentFrame.center[2])
      expect(runtimeFrame.radius).toBe(documentFrame.radius)
    })

    it.each(SHIPPED_SLUGS)('builds the same views and limits for %s', async (slug) => {
      const modelPath = await modelPathOf(ROOT, slug)
      const { doc, frame: documentFrame } = await shippedDocument(slug)
      const facts = productCameraFactsOf(doc, modelPath)
      const { manifest } = await shippedManifest(slug)
      const parsed = await readSharedParsedProduct(await modelPathOf(ROOT, slug))

      // The home ray the document facts read, against the loader's camera
      // world transform, in model space.
      const homeFact = readCameraFacts(doc).find((fact) => fact.name === CAMERA_HOME_NAME)
      if (homeFact === undefined || homeFact.ray === null) {
        throw new Error(`the shipped product ${slug} carries no home camera ray`)
      }
      const homeCamera = parsed.scene.getObjectByName(CAMERA_HOME_NAME)
      if (!(homeCamera instanceof PerspectiveCamera)) {
        throw new Error(`the loader tree of ${slug} holds no perspective ${CAMERA_HOME_NAME}`)
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
      const { rig, frame } = presentedProduct(parsed, manifest)
      const plan = plannedCamera(rig, manifest, frame)
      const structure = readProductStructure(doc)
      expect([...plan.views.keys()]).toEqual(
        contractViews(manifest, structure, documentFrame, cameraContract).views.map(
          (view) => view.id,
        ),
      )
      for (const [id, view] of plan.views) {
        const expected = id === CAMERA_HOME_ID ? facts.home : facts.closeUps.get(id)
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
        manifest.camera?.minDistance ??
          facts.home.distance * cameraLimitConfig.minHomeDistanceRatio,
      )
      expect(plan.distanceRange.max).toBe(
        manifest.camera?.maxDistance ??
          facts.home.distance * cameraLimitConfig.maxHomeDistanceRatio,
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
      const { rig, frame } = presentedProduct(
        await readSharedParsedProduct(await modelPathOf(ROOT, slug)),
        manifest,
      )
      const structure = readProductStructure(doc)

      // Camera blocks that bracket a view's distance: validate and the
      // runtime fail on the same problems, by the same values, in the same
      // order. The manifest input parses again with the block, so both sides
      // see the real schema output.
      const manifestWith = (camera: { minDistance?: number; maxDistance?: number }): Product =>
        parseProduct({ ...(input as Record<string, unknown>), camera }, `the ${slug} fixture`)
      for (const bracket of bracketsOf(facts, documentFrame)) {
        const validateViolations = checkCameras(
          manifestWith(bracket.block),
          structure,
          cameraContract,
        ).violations
        const problems = planProblems(rig, manifestWith(bracket.block), frame)
        if (problems === null) {
          throw new Error(`the plan built under the bracket of ${slug} for ${bracket.expected}`)
        }
        const messages = problems.map((problem) => problem.message)
        expect(validateViolations).toEqual(messages)
        // The bracket hits the view it brackets, so the agreement covers that
        // view's own rule, not only a problem some other view raises.
        expect(messages).toContainEqual(expect.stringContaining(bracket.expected))
      }
    })

    it.each(SHIPPED_SLUGS)(
      'fails on the same geometry problems for %s on both sides, view by view',
      async (slug) => {
        const { manifest } = await shippedManifest(slug)
        const { doc: shipped } = await shippedDocument(slug)
        const ids = contractViews(
          manifest,
          readProductStructure(shipped),
          frameSpanOfMeshBoxes(readMeshBoxes(shipped)),
          cameraContract,
        ).views.map((view) => view.id)
        // One view at a time takes a degenerate field of view in the shipped
        // document, which both sides then read: validate from the document,
        // the runtime from the real loader's parse of the same document. The
        // geometry rule names that view on both sides, by the same message,
        // and the rules every other view answers to still agree beside it.
        for (const id of ids) {
          const { doc } = await shippedDocument(slug)
          const camera = firstNodeNamed(doc, `${CAMERA_PREFIX}${id}`).getCamera()
          if (camera === null) {
            throw new Error(`the ${CAMERA_PREFIX}${id} node of ${slug} carries no camera`)
          }
          camera.setYFov(0)
          const validateViolations = checkCameras(
            manifest,
            readProductStructure(doc),
            cameraContract,
          ).violations
          const { rig, frame } = presentedProduct(await parseDocumentWithLoader(doc), manifest)
          const problems = planProblems(rig, manifest, frame)
          if (problems === null) {
            throw new Error(`the plan of ${slug} built with a degenerate ${CAMERA_PREFIX}${id}`)
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
  },
)
