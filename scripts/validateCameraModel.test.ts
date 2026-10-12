import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { parseProduct } from '../src/lib/product/index.ts'
import { manifest as speakerManifest } from '../tests/fixtures/products/placeholder-speaker/placeholder-speaker.fixtures.ts'
import { createModelIO } from './modelIo.ts'
import { modelPathOf } from './fixtureProducts.ts'
import { readProductStructure } from './structure.ts'
import { checkCameras } from './validateCameras.ts'
import { cameraContract } from './validateFixtures.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('the authored camera model', () => {
  let structure: ReturnType<typeof readProductStructure>

  beforeAll(async () => {
    const io = await createModelIO()
    structure = readProductStructure(await io.read(await modelPathOf(ROOT, 'placeholder-speaker')))
  }, TOOL_FIXTURE_TIMEOUT_MS)

  it('holds the placeholder speaker between its close-up reach and its close-up distance', () => {
    // The driver view is 0.2957 m from its target and the model reaches
    // 0.2846 m: the authored minimum must clear the reach and stay below
    // the view distance, through the real fixture model's camera assembly.
    const withMinimum = (minDistance: number) =>
      checkCameras(
        parseProduct({ ...speakerManifest, camera: { minDistance } }, 'placeholder-speaker'),
        structure,
        cameraContract,
      ).violations

    expect(withMinimum(0.28)).toEqual([
      expect.stringMatching(
        /^the placeholder-speaker CAM_driver minimum distance 0\.28 does not exceed the model reach 0\.2846\d* from its orbit target, projected from the HS_driver anchor$/,
      ),
    ])
    expect(withMinimum(0.3)).toEqual([
      expect.stringMatching(
        /^the CAM_driver distance 0\.2957\d* lies outside the distance limits \[0\.3, /,
      ),
    ])
    expect(
      checkCameras(parseProduct(speakerManifest, 'placeholder-speaker'), structure, cameraContract)
        .violations,
    ).toEqual([])
  })
})
