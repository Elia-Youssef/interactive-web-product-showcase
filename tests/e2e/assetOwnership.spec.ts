import { productModelUrl } from '../../src/lib/product'
import { expect, test } from './fixtures'
import { observeAssetEnvironment, observeAssetOwnership } from './assetOwnershipRoute'
import { stageConfig } from '../../src/viewer/config'
import { composeTestModule } from './composeTestModule'
import { holdAsset } from './heldAssetRoute'
import { loadCollection } from './productList'
import { harnessPath, productLoadBudgetMs } from './productSpecs'

const first = (await loadCollection()).first

test('a model arriving after stage unmount decodes and disposes before its decoder retires', async ({
  page,
  backendPath,
}) => {
  const observations = await observeAssetOwnership(page)
  const mounting = await composeTestModule(page, {
    path: '/src/viewer/Stage.tsx',
    name: 'Stage',
    fixture: '/tests/fixtures/mountableStage.fixtures.tsx',
    compose: 'renderMountableStage',
    args: [],
  })
  const model = await holdAsset(page, productModelUrl(first.slug))
  try {
    await page.goto(harnessPath(backendPath, first.slug))
    await expect.poll(model.isHeld, { timeout: productLoadBudgetMs }).toBe(true)
    await page.getByTestId('remount-stage').dispatchEvent('click')
    await expect(page.locator('canvas')).toHaveCount(0)
    const pending = await page.evaluate(() =>
      window.__assetModelOwners?.filter((owner) => owner.events.includes('bytes started')),
    )
    expect(pending).toHaveLength(1)
    expect(pending?.[0]?.events).not.toContain('decoder disposed')
  } finally {
    model.release()
  }
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__assetModelOwners
            ?.filter((owner) => owner.events.includes('bytes started'))
            .every((owner) => owner.events.includes('decoder disposed')),
        ),
      { timeout: productLoadBudgetMs },
    )
    .toBe(true)
  const [owner] = await page.evaluate(
    () =>
      window.__assetModelOwners?.filter((entry) => entry.events.includes('bytes started')) ?? [],
  )
  expect(owner?.events).toContain('parse finished')
  expect(owner?.events).toContain('decode finished')
  expect(owner?.geometryDisposals.length).toBeGreaterThan(0)
  expect(owner?.textureDisposals.length).toBeGreaterThan(0)
  expect(owner?.geometryDisposals.every((count) => count === 1)).toBe(true)
  expect(owner?.textureDisposals.every((count) => count === 1)).toBe(true)
  expect(owner?.events.at(-1)).toBe('decoder disposed')
  expect(await page.evaluate(() => window.__viewer)).toBeUndefined()
  expect(observations()).toBe(1)
  expect(mounting()).toBe(1)
})

test('a pending HDR is decoded and released once after its committed stage unmounts', async ({
  page,
  backendPath,
}) => {
  const observations = await observeAssetEnvironment(page)
  const mounting = await composeTestModule(page, {
    path: '/src/viewer/Stage.tsx',
    name: 'Stage',
    fixture: '/tests/fixtures/mountableStage.fixtures.tsx',
    compose: 'renderMountableStage',
    args: [],
  })
  const environment = await holdAsset(page, stageConfig.environmentFile)
  try {
    await page.goto(harnessPath(backendPath, first.slug))
    await expect.poll(environment.isHeld, { timeout: productLoadBudgetMs }).toBe(true)
    await page.getByTestId('remount-stage').dispatchEvent('click')
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(
      await page.evaluate(() => window.__assetEnvironments?.map((owner) => owner.events)),
    ).toEqual([['started']])
  } finally {
    environment.release()
  }
  await expect
    .poll(() => page.evaluate(() => window.__assetEnvironments?.map((owner) => owner.events)), {
      timeout: productLoadBudgetMs,
    })
    .toEqual([['started', 'loaded', 'disposed']])
  expect(await page.evaluate(() => window.__viewer)).toBeUndefined()
  expect(observations()).toBe(1)
  expect(mounting()).toBe(1)
})
