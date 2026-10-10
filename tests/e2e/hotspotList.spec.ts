import { expect, test } from './fixtures'
import { productPathOf } from './collectionFacts'
import { shippedProducts } from './productSpecs'
import { readProductCameraFacts } from './productCamera'
import { mountedMarkerOf, markerOf, stageOverlayOf } from './hotspotViews'
import { explodeToggleLabel } from '../../src/lib/copy/productPanel'
import { siteCopy } from '../../src/lib/copy/site'
import { stageCameraConfig } from '../../src/viewer/camera/config'
import {
  expectOrbitAtRest,
  resolvedDistanceRange,
  stageAspectOfCanvas,
  viewExpectation,
} from './stageCamera'
import { cameraAtRest, readyStage, shownMarkerOf } from './stageKeys'
import {
  expectCameraStayed,
  expectFocused,
  hiddenHotspotOf,
  highlightsButtonOf,
  itemOf,
  listSubjectsOf,
  panelOf,
  tabTo,
} from './highlightsList'

// The Highlights list on the site's own product pages, for every shipped
// product with hotspots, by its own data: the list names every hotspot in
// manifest order under a heading named with the count; the keyboard alone
// opens a hotspot's card inline under its item, the camera entering a
// close-up where the model has one and staying where it has none; Escape
// closes it and focus returns to the item; a card opened from the list
// shows whatever the stage hides; a marker press takes it to the stage;
// and a phone reaches the list and lays the card out whole.

const products = (await shippedProducts()).filter((product) => product.hotspots.length > 0)

for (const product of products) {
  const path = (backendPath: string) => productPathOf(backendPath, product)
  const subjects = await listSubjectsOf(product)

  test(`${product.slug}: the list names every hotspot, in manifest order`, async ({
    page,
    backendPath,
  }) => {
    await readyStage(page, path(backendPath))
    const section = highlightsButtonOf(page, product)
    await expect(section).toHaveAttribute('aria-expanded', 'false')
    await expect(panelOf(page).getByRole('list')).toHaveCount(0)

    await section.click()
    await expect(section).toHaveAttribute('aria-expanded', 'true')
    const titles = panelOf(page).getByRole('listitem').getByRole('button')
    await expect(titles).toHaveText(product.hotspots.map((hotspot) => hotspot.title))
  })

  for (const [kind, subject] of Object.entries(subjects)) {
    if (subject === undefined) {
      continue
    }
    test(`${product.slug}: the keyboard opens the ${kind} hotspot inline and Escape returns`, async ({
      page,
      backendPath,
    }) => {
      await readyStage(page, path(backendPath))
      const home = await cameraAtRest(page)
      const section = highlightsButtonOf(page, product)
      await tabTo(page, section)
      await page.keyboard.press('Enter')
      const { button, card } = itemOf(page, subject.title)
      await tabTo(page, button)
      await page.keyboard.press('Enter')

      await expect(card.getByRole('heading', { level: 3, name: subject.title })).toBeVisible()
      await expect(card.getByRole('listitem')).toHaveText([...subject.bullets])
      await expect(button).toHaveAttribute('aria-expanded', 'true')
      await expect(mountedMarkerOf(page, subject.title)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
      const facts = await readProductCameraFacts(product.slug)
      const closeUp = facts.closeUps.get(subject.id)
      if (closeUp === undefined) {
        await expectCameraStayed(page, home, 'a hotspot with no close-up moves no camera')
      } else {
        const expected = viewExpectation(
          closeUp,
          facts.home.aspect,
          resolvedDistanceRange(product, facts.home.distance),
          await stageAspectOfCanvas(page),
        )
        expectOrbitAtRest(await cameraAtRest(page), expected, 'the list enters the close-up')
      }

      await page.keyboard.press('Escape')
      await expect(page.getByTestId('hotspot-card')).toHaveCount(0)
      await expect(button).toHaveAttribute('aria-expanded', 'false')
      await expectFocused(button, 'focus returns to the list item')
      expectOrbitAtRest(await cameraAtRest(page), home, 'the camera is home again')
    })
  }

  test(`${product.slug}: exploded, a list card shows while its marker is hidden`, async ({
    page,
    backendPath,
  }) => {
    test.slow()
    await readyStage(page, path(backendPath))
    await page.getByRole('button', { name: explodeToggleLabel(product) }).click()
    // Turn the exploded product a rotate step at a time, up to one full
    // turn, until the view hides a marker: the parts occlude their anchors
    // from some side, and a hidden marker is what the list card must not
    // follow into hiding.
    const turnSteps = Math.ceil(360 / stageCameraConfig.rotateStepDegrees)
    let subject = await hiddenHotspotOf(page, product)
    for (let step = 0; step < turnSteps && subject === undefined; step += 1) {
      await page.getByRole('button', { name: siteCopy.rotateRightLabel }).click()
      await cameraAtRest(page)
      subject = await hiddenHotspotOf(page, product)
    }
    if (subject === undefined) {
      throw new Error(`no view of the exploded ${product.slug} within one turn hides a marker`)
    }
    const before = await cameraAtRest(page)

    await highlightsButtonOf(page, product).click()
    const { button, card } = itemOf(page, subject.title)
    await button.click()
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: subject.title })).toBeVisible()
    await expectCameraStayed(page, before, 'an exploded product starts no close-up')
  })

  test(`${product.slug}: a marker press moves the list card to the stage, one card at a time`, async ({
    page,
    backendPath,
  }) => {
    await readyStage(page, path(backendPath))
    const marker = await shownMarkerOf(page, product)
    const title = await marker.getAttribute('aria-label')
    if (title === null) {
      throw new Error('a marker is named by its hotspot title')
    }
    await highlightsButtonOf(page, product).click()
    const { button, card } = itemOf(page, title)
    await button.click()
    await expect(card).toBeVisible()
    await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
    await cameraAtRest(page)

    await markerOf(page, title).click()
    await expect(card).toHaveCount(0)
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
    await expect(
      stageOverlayOf(page)
        .getByTestId('hotspot-card')
        .or(panelOf(page).getByTestId('hotspot-card')),
    ).toBeVisible()
  })
}

// The phone sizes: the sheet scrolls to the list, and a card opened from it
// lays out inside the panel's width with every part reachable.
for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  for (const product of products) {
    test(`${product.slug}: at ${viewport.width}x${viewport.height} the list and its card are reachable whole`, async ({
      page,
      backendPath,
    }) => {
      await page.setViewportSize(viewport)
      await readyStage(page, productPathOf(backendPath, product))
      const section = highlightsButtonOf(page, product)
      await section.scrollIntoViewIfNeeded()
      await expect(section).toBeInViewport()
      await section.click()

      const last = product.hotspots.at(-1)
      if (last === undefined) {
        throw new Error(`${product.slug} lists no hotspot`)
      }
      const { button, card } = itemOf(page, last.title)
      await button.scrollIntoViewIfNeeded()
      await button.click()
      // Every part of the card scrolls into view, whatever scrolls (the
      // sheet or the document) and however short its band: the close
      // button, the title and each bullet.
      for (const part of [
        card.getByRole('button'),
        card.getByRole('heading', { name: last.title }),
        ...(await card.getByRole('listitem').all()),
      ]) {
        await part.scrollIntoViewIfNeeded()
        await expect(part).toBeInViewport({ ratio: 1 })
      }
      const panel = await panelOf(page).boundingBox()
      const box = await card.boundingBox()
      if (panel === null || box === null) {
        throw new Error('the panel and the card must have boxes')
      }
      expect(box.x, 'the card starts inside the panel').toBeGreaterThanOrEqual(panel.x)
      expect(box.x + box.width, 'the card ends inside the panel').toBeLessThanOrEqual(
        panel.x + panel.width,
      )
    })
  }
}
