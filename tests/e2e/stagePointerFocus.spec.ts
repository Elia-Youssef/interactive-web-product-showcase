import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { openShownCard, productPathOf, productWithHotspots } from './collectionFacts'
import { markerOf } from './hotspotViews'
import { expectOrbitAtRest } from './stageCamera'
import { driveCardPointer } from './pointerGesture'
import { cameraAtRest, keyTargetOf, readyStage, rotateStep, scrollPositions } from './stageKeys'

const collection = await loadCollection()
const subject = productWithHotspots(collection)
const path = (backendPath: string) => productPathOf(backendPath, subject)

for (const gesture of ['click', 'drag'] as const) {
  test(`canvas ${gesture} hands focus to the keys without scrolling or a pointer ring`, async ({
    page,
    backendPath,
  }) => {
    await readyStage(page, path(backendPath))
    await page.getByRole('radio').first().focus()
    const beforeScroll = await scrollPositions(page)
    const canvas = await page.locator('canvas').boundingBox()
    if (canvas === null) {
      throw new Error('the presented canvas must have a box')
    }
    const x = canvas.x + 20
    const y = canvas.y + canvas.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await expect(
      page.getByRole('radio').first(),
      'pending stage input keeps its prior focus',
    ).toBeFocused()
    if (gesture === 'drag') {
      await page.mouse.move(x + canvas.width / 5, y, { steps: 10 })
    }
    await page.mouse.up()
    const target = keyTargetOf(page)
    await expect(target).toBeFocused()
    expect(await target.evaluate((element) => element.matches(':focus-visible'))).toBe(false)
    expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none')
    expect(await scrollPositions(page)).toBe(beforeScroll)
    const beforeKey = await cameraAtRest(page)
    await page.keyboard.press('ArrowRight')
    const afterKey = await cameraAtRest(page)
    expect(afterKey.azimuth).toBeCloseTo(beforeKey.azimuth - rotateStep, 9)
    expect(await scrollPositions(page)).toBe(beforeScroll)
  })
}

for (const gesture of ['click', 'drag'] as const) {
  test(`canvas ${gesture} with an open card chooses one focus outcome and continues by keyboard`, async ({
    page,
    backendPath,
  }) => {
    await readyStage(page, path(backendPath))
    const title = await openShownCard(page, subject)
    const opened = await cameraAtRest(page)
    const beforeScroll = await driveCardPointer(page, gesture)
    const target = keyTargetOf(page)
    if (gesture === 'click') {
      await expect(page.getByTestId('hotspot-card')).toHaveCount(0)
      const marker = markerOf(page, title)
      await expect(marker).toBeFocused()
      const beforeKey = await cameraAtRest(page)
      await page.keyboard.press('ArrowRight')
      expect(await cameraAtRest(page)).toEqual(beforeKey)
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
      expectOrbitAtRest(
        await cameraAtRest(page),
        opened,
        'keyboard activation restores the card view',
      )
    } else {
      await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
      await expect(target).toBeFocused()
      expect(await target.evaluate((element) => element.matches(':focus-visible'))).toBe(false)
      expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
        'none',
      )
      const beforeKey = await cameraAtRest(page)
      await page.keyboard.press('ArrowRight')
      const afterKey = await cameraAtRest(page)
      expect(afterKey.azimuth).toBeCloseTo(beforeKey.azimuth - rotateStep, 9)
      expect(await scrollPositions(page)).toBe(beforeScroll)
    }
  })
}
