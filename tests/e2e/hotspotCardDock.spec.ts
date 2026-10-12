import { dockOpenViewCandidates } from './dockOpenViewCandidates'
import { join } from 'node:path'
import { CompletedDockBehaviors } from './completedDockBehaviors'
import { readMarkerExtentTokens } from './markerExtentTokens'
import { registerDockSwitchCases } from './dockSwitchCases'
import { dockProbeBudgetMs, dockVisitorZoomBudgetMs } from './dockProbeBudget'
import { dockSelectionAt, skipUnlessDockFlow, skipUnlessMarkerShown } from './dockCaseSelection'
import { requireRunnableDockCases, requireDockBehaviors } from './dockFlowCases'
import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { flowFacts, closeWays } from './hotspotFlowFacts'
import { expectProduct, productPathOf } from './collectionFacts'
import { shippedProducts } from './productSpecs'
import { completedPresentation } from './presentationCompletion'
import { expectOrbitAtRest, stageAspectOfCanvas } from './stageCamera'
import { markerOf, requireCamera } from './hotspotViews'
import { stageBoxOf, viewportContracts } from './layoutContracts'
import {
  dockClassificationReport,
  selectDockFlowLayouts,
  type DockLayoutCandidates,
  type DockLayoutSelection,
} from './dockFlowSelection'
import {
  expectClosedCard,
  expectDockedCardOf,
  expectInstantlyAt,
  cameraAfterRenderedClick,
  openDockedCard,
  scrollSheetToEnd,
} from './dockCardViews'
import {
  expectPlainCloseCameraUnchanged,
  preparePlainCloseCamera,
  readPlainCloseCamera,
} from './plainCardCamera'

const extent = await readMarkerExtentTokens()
const { flowsAt, markerViewsAt, factsBySlug } = await flowFacts(await shippedProducts())
const dockingLayouts = viewportContracts.filter((contract) => contract.hotspotCard === 'docks')

const layouts = dockingLayouts.map((contract) => {
  const stage = stageBoxOf(contract)
  const markerViews = markerViewsAt(stage)
  return {
    contract,
    products: flowsAt(stage).map((flow) => {
      const { product } = flow.subject
      const views = markerViews.get(product.slug)
      if (views === undefined) {
        throw new Error(`no marker views for ${product.slug}`)
      }
      const facts = factsBySlug.get(product.slug)
      if (facts === undefined) throw new Error(`no Node hotspot facts for ${product.slug}`)
      return {
        flow,
        nodeShownHome: [...views.home],
        openViews: dockOpenViewCandidates(flow, views, facts, { box: stage, extent }),
      }
    }),
  }
})

const selection = new Map<string, DockLayoutSelection>()
let setupCostMs = 0

for (const { contract, products } of layouts) {
  const size = `${contract.width}x${contract.height}`
  test.describe(`dock flow at ${size}`, () => {
    test.describe.configure({ mode: 'default' })
    const completed = new CompletedDockBehaviors()
    test.beforeAll(async ({ browser, backendPath }, testInfo) => {
      completed.resume(
        join(
          testInfo.project.outputDir,
          'dock-completions',
          `${encodeURIComponent(JSON.stringify([testInfo.project.name, size, testInfo.repeatEachIndex]))}.jsonl`,
        ),
      )
      if (selection.has(size)) return
      const started = performance.now()
      const candidates: readonly DockLayoutCandidates[] = [
        {
          width: contract.width,
          height: contract.height,
          products: products.map(({ flow, nodeShownHome, openViews }) => ({
            product: flow.subject.product,
            nodeShownHome,
            openViews,
          })),
        },
      ]
      test.setTimeout(dockProbeBudgetMs(candidates))
      try {
        const read = (await selectDockFlowLayouts(browser, backendPath, candidates)).get(size)
        if (read === undefined) throw new Error(`no live selection for ${size}`)
        requireRunnableDockCases(
          size,
          products.map((entry) => entry.flow),
          read,
        )
        selection.set(size, read)
      } finally {
        setupCostMs += performance.now() - started
        await testInfo.attach('dock-setup-cost', {
          body: JSON.stringify({ worker: testInfo.workerIndex, setupCostMs }),
          contentType: 'application/json',
        })
      }
    })

    test(`dock layout classification at ${size}: the live reads decide the flow`, async ({}, testInfo) => {
      const read = selection.get(size)
      if (read === undefined)
        throw new Error(`the ${size} layout must be read before its cases run`)
      const anyShown = [...read.products.values()].some((product) => product.shownHome.size > 0)
      expect(read.kind === 'dock-flow', `the classification of ${size} follows the reads`).toBe(
        anyShown,
      )
      await testInfo.attach('dock-layout-classification', {
        body: dockClassificationReport(size, read),
        contentType: 'application/json',
      })
    })

    for (const candidate of products) {
      const flow = candidate.flow
      const { product, closeUps, plains } = flow.subject
      const nodeShownHome = new Set(candidate.nodeShownHome)
      const openDocked = (
        page: Page,
        backendPath: string,
        title: string,
        beforeOpen?: (page: Page) => Promise<void>,
      ) => openDockedCard(page, backendPath, product, contract, title, beforeOpen)

      for (const closeUp of closeUps.filter((entry) => nodeShownHome.has(entry.id))) {
        for (const [way, closeBy] of closeWays) {
          test(`docked card at ${size}: ${product.slug} closing the close-up card of ${closeUp.title} by ${way} clears the pressed state and returns the camera home`, async ({
            page,
            backendPath,
          }) => {
            if (way === 'pressing the active marker') test.setTimeout(dockVisitorZoomBudgetMs())
            skipUnlessMarkerShown(
              dockSelectionAt(selection, size),
              size,
              product.slug,
              closeUp.id,
              closeUp.title,
            )
            await openDocked(page, backendPath, closeUp.title)
            await completedPresentation(page)
            await closeBy(page, closeUp.title)
            await expectClosedCard(page, closeUp.title)
            await completedPresentation(page)
            expectOrbitAtRest(
              await requireCamera(page),
              flow.homeAt(await stageAspectOfCanvas(page)),
              way,
            )
            completed.add(`close by ${way}`)
          })
        }
      }

      for (const plain of plains.filter((entry) => nodeShownHome.has(entry.id))) {
        for (const [way, closeBy] of closeWays) {
          test(`docked card at ${size}: ${product.slug} closing the plain card of ${plain.title} by ${way} clears the pressed state and moves nothing`, async ({
            page,
            backendPath,
          }) => {
            if (way === 'pressing the active marker') test.setTimeout(dockVisitorZoomBudgetMs())
            skipUnlessMarkerShown(
              dockSelectionAt(selection, size),
              size,
              product.slug,
              plain.id,
              plain.title,
            )
            await openDocked(page, backendPath, plain.title, preparePlainCloseCamera)
            const cameraBefore = await readPlainCloseCamera(page)
            await closeBy(page, plain.title)
            await expectClosedCard(page, plain.title)
            await expectPlainCloseCameraUnchanged(page, cameraBefore, way)
            completed.add(`close by ${way}`)
          })
        }
      }

      for (const hotspot of product.hotspots.filter((entry) => nodeShownHome.has(entry.id))) {
        test(`docked card at ${size}: ${product.slug} the card of ${hotspot.title} docks into view from a sheet scrolled to its end`, async ({
          page,
          backendPath,
        }) => {
          skipUnlessMarkerShown(
            dockSelectionAt(selection, size),
            size,
            product.slug,
            hotspot.id,
            hotspot.title,
          )
          await openDocked(page, backendPath, hotspot.title, scrollSheetToEnd)
          completed.add('open')
          completed.add('readability')
        })
      }

      registerDockSwitchCases(flow, contract, selection, completed)

      for (const closeUp of closeUps.filter((entry) => nodeShownHome.has(entry.id))) {
        test(`docked card at ${size}: ${product.slug} under reduced motion the close-up of ${closeUp.title} and the return home land on the next rendered frame`, async ({
          page,
          backendPath,
        }) => {
          skipUnlessMarkerShown(
            dockSelectionAt(selection, size),
            size,
            product.slug,
            closeUp.id,
            closeUp.title,
          )
          await page.emulateMedia({ reducedMotion: 'reduce' })
          await page.setViewportSize({ width: contract.width, height: contract.height })
          await page.goto(productPathOf(backendPath, product))
          await expectProduct(page, product)
          await completedPresentation(page)
          const aspect = await stageAspectOfCanvas(page)
          const atOpen = await cameraAfterRenderedClick(page, () =>
            markerOf(page, closeUp.title).click(),
          )
          expectInstantlyAt(atOpen, flow.viewAt(closeUp.view, aspect))
          await expectDockedCardOf(page, closeUp.title)

          const atClose = await cameraAfterRenderedClick(page, () =>
            page.getByRole('button', { name: siteCopy.closeLabel }).click(),
          )
          expectInstantlyAt(atClose, flow.homeAt(aspect))
          await expectClosedCard(page, closeUp.title)
          completed.add('reduced motion')
        })
      }
    }
    test(`dock runnable behaviors at ${size}: every required behavior completed`, () => {
      skipUnlessDockFlow(dockSelectionAt(selection, size), size)
      requireDockBehaviors(size, completed)
    })
  })
}
