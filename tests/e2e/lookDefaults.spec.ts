import { SRGBColorSpace } from 'three'
import { resolveProductLook } from '../../src/lib/product'
import { lookDefaults } from '../../src/viewer/look/config'
import { expect, test } from './fixtures'
import { testBodyBudgetMs } from './budgets'
import { lookHarnessPath } from './lookHarness'
import { expectPoll, harnessProducts, waitForProductReady } from './productSpecs'

// The product's look at ready, on every matrix project: every product
// reports ready with its manifest's look block applied as authored and the
// config defaults filling every field the block leaves out (all of them
// for a product without a block), read back from the renderer, the scene
// and the shadow material, and every loaded texture's color space matches
// its glTF slot.
const products = await harnessProducts()

// The glTF slots the spec samples as color, so the loader leaves them sRGB.
// They are the color textures of glTF 2.0: base color and emissive from the
// core material, sheen color and specular color from the material
// extensions. The loader assigns each of them its sRGB space at
// node_modules/three/examples/jsm/loaders/GLTFLoader.js:836, :1127, :1330
// and :3728; every other slot carries data, not color.
const srgbSlots = new Set(['map', 'emissiveMap', 'sheenColorMap', 'specularColorMap'])

for (const product of products) {
  const look = resolveProductLook(product.look, lookDefaults)

  test(`the ${product.slug} look, its manifest block over the defaults, is applied when it reports ready`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(lookHarnessPath(backendPath, product.slug))
    await waitForProductReady(page)

    // The applied look, read from the live renderer, scene and material:
    // the values are the resolved look, and the shadow material carries
    // the compositing flags (blend, no depth write). Tone mapping has no
    // per-material flag in the node renderer: the output pass tone maps the
    // whole frame once, and the shadow's baked black is a fixed point of it.
    await expectPoll(
      page,
      () => {
        const look = window.__viewer?.look ?? null
        if (look === null) {
          return null
        }
        return {
          exposure: look.exposure,
          environmentIntensity: look.environmentIntensity,
          environmentRotationDeg: look.environmentRotationDeg,
          shadow: look.shadow,
        }
      },
      testBodyBudgetMs,
    ).toEqual({
      exposure: look.exposure,
      environmentIntensity: look.environmentIntensity,
      environmentRotationDeg: look.environmentRotationDeg,
      shadow: {
        opacity: look.shadowOpacity,
        transparent: true,
        depthWrite: false,
      },
    })
  })

  test(`the ${product.slug} textures match their glTF slots on color space`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(lookHarnessPath(backendPath, product.slug))
    await waitForProductReady(page)

    const textures = await page.evaluate(() => window.__viewer?.look?.textures ?? null)
    if (textures === null) {
      throw new Error('the look texture table is missing at ready')
    }
    expect(
      textures.length,
      'the walk must report the loaded textures, not an empty scene',
    ).toBeGreaterThan(0)
    for (const texture of textures) {
      const expectSrgb = srgbSlots.has(texture.slot)
      expect(
        texture.colorSpace === SRGBColorSpace,
        `${texture.material} slot ${texture.slot} must ${expectSrgb ? 'sample as sRGB' : 'stay non-color'}, got '${texture.colorSpace}'`,
      ).toBe(expectSrgb)
    }
  })
}
