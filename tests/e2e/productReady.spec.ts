import { CAMERA_HOME_ID, CAMERA_PREFIX } from '../../src/lib/product/contractNames.ts'
import { expect, test } from './fixtures'
import { readProductModelFacts } from './productModel'
import { expectPoll, harnessPath, harnessProduct, waitForProductReady } from './productSpecs'

test('the placeholder loads and its rig equals the manifest and model contract', async ({
  page,
  backendPath,
}) => {
  const product = harnessProduct()
  const facts = await readProductModelFacts(product.slug)
  await page.goto(harnessPath(backendPath, product.slug))

  await waitForProductReady(page)

  // The rig summary is the contract: assert it against the manifest's words
  // and the committed model's own facts, never hand-typed guesses. Parts
  // have no contract order and are compared sorted; the hotspots keep
  // manifest order and the cameras home first, because the rig builds both
  // in those orders.
  await expectPoll(page, () => window.__viewer?.rig).toEqual({
    parts: [...facts.partNames].sort(),
    hotspots: product.hotspots.map((hotspot) => ({
      id: hotspot.id,
      part: facts.hotspotParts.get(hotspot.id),
    })),
    cameras: [
      `${CAMERA_PREFIX}${CAMERA_HOME_ID}`,
      ...product.hotspots.map((hotspot) => `${CAMERA_PREFIX}${hotspot.id}`),
    ].filter((name) => facts.cameraNames.includes(name)),
    clip: { name: product.explode.clip, durationSeconds: facts.clipDurationSeconds },
    variants: product.finishes.map((finish) => finish.variant),
  })

  // The camera contract itself: home is there, and the model names each
  // camera the rig reports.
  const rig = await page.evaluate(() => window.__viewer?.rig)
  expect(rig?.cameras).toContain(`${CAMERA_PREFIX}${CAMERA_HOME_ID}`)
  for (const camera of rig?.cameras ?? []) {
    expect(facts.cameraNames).toContain(camera)
  }
})
