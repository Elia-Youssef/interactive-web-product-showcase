import { expect, type Page } from '@playwright/test'
import { test } from './fixtures'
import { testBodyBudgetMs, testBudgetMs } from './budgets'
import type { Product } from '../../src/lib/product'
import { loadCollection } from './productList'
import type { BrowserName } from './matrix'
import { neighborsOf, productPathOf, rowControls } from './collectionFacts'
import {
  harnessPath,
  leaveProduct,
  waitForProductReady,
  waitForSettledMemory,
  waitForStageWarm,
  type RendererMemory,
} from './productSpecs'
import { modelUrlOf, stageLoads, waitForRest } from './productSwitchFacts'
import { readPageHeap } from './pageHeap'

// The leak check of the product switch: browsing through the whole
// collection, over and over, leaves the page where a warm-up left it. The
// walk runs on the app itself, through the next link, so every swap is the
// real switch: cover, dispose, load, reveal, and the reads ahead.
//
// The readings are taken at rest on the first product, after whole cycles
// through the collection, so every reading shows the same product with the
// same reads ahead. A first cycle warms the page up: the first visit of
// every product creates what the renderer and the engine keep for the
// page's lifetime. Two measured cycles follow, then the proof runs at least
// twenty swaps, in whole cycles, and reads again:
//
// - GPU memory, from the renderer's own counters (geometries, attributes,
//   index attributes and textures, each with its bytes), plus the entries
//   of the WebGL2 fallback's vertex array cache, the one resource class
//   those counters do not count: exactly the measured cycles' reading. The
//   readings are exact, and one resource left behind per swap is the
//   smallest leak there is.
// - The JS heap the page holds, where the engine can measure it: no more
//   than the larger measured reading plus half the smallest product's
//   geometry bytes. A product's geometry bytes are exact: the distinct
//   array buffers behind its attributes, which the stage reports for the
//   product it presented and which releasing the product frees at the
//   least, since nothing outside the product references them. A swap that
//   leaks any product retains at least its geometry bytes, and the proof
//   runs three cycles or more after the measured ones, so a leak of any one
//   product per cycle grows the heap past the bound several times over; the
//   noise of a reading is kilobytes against megabytes. The texture bytes
//   are left out of the unit: three's node materials keep the last material
//   read for each property, with its textures, until another material is
//   read for it, so a release frees them only once the next product renders.
//   Before the walk, every product's retention is measured on the harness,
//   as the heap with the product held less the heap once its leave has
//   landed, and must be at least its geometry bytes: a reading that cannot
//   see a released product fails there, by name, instead of passing a bound
//   it cannot measure against. What the heap check covers is what no counter
//   sees: JS objects the released products left behind, their typed arrays
//   and their materials; every GPU object the counters count is theirs.

const collection = await loadCollection()
const products = collection.products
const start = collection.first

// The proof's cycles: twenty swaps at least, and never fewer than three
// cycles, so a leak of one product per cycle is several times its bytes.
const PROOF_MIN_SWAPS = 20
const PROOF_MIN_CYCLES = 3
const proofCycles = Math.max(Math.ceil(PROOF_MIN_SWAPS / products.length), PROOF_MIN_CYCLES)
const MEASURED_CYCLES = 2

type Reading = {
  readonly gpu: RendererMemory
  // Bytes of JS heap the page holds, or null where the engine has no
  // measure of it.
  readonly heap: number | null
}

// One product's harness measurement: the geometry bytes the stage reports
// it holds, and the heap its release freed.
type Retention = { readonly geometry: number; readonly retained: number }

// The heap reader of the engine, or null where there is none. Chromium
// exposes performance.memory, but without a launch flag its values are
// bucketed and refreshed only every few minutes, and they count the
// engine's compiled code with the page's objects, so the proof reads the
// heap through the engine's own protocol instead (tests/e2e/pageHeap.ts).
// Firefox and WebKit have neither performance.memory nor that protocol, so
// there the GPU counters carry the proof alone.
async function heapReaderOf(
  page: Page,
  browserName: BrowserName,
): Promise<(() => Promise<number>) | null> {
  if (browserName !== 'chromium') {
    expect(await page.evaluate(() => 'memory' in performance)).toBe(false)
    return null
  }
  const session = await page.context().newCDPSession(page)
  return () => readPageHeap(session)
}

// Tracks the model files the page is still reading, so a reading waits for
// the reads ahead to land: a file in flight is memory on its way in.
function trackModelReads(page: Page): () => number {
  let inFlight = 0
  const isModel = (url: string) => new URL(url).pathname.startsWith('/models/')
  page.on('request', (request) => {
    if (isModel(request.url())) {
      inFlight += 1
    }
  })
  const done = (request: { url(): string }) => {
    if (isModel(request.url())) {
      inFlight -= 1
    }
  }
  page.on('requestfinished', done)
  page.on('requestfailed', done)
  return () => inFlight
}

async function swapToNext(page: Page, from: Product): Promise<Product> {
  const target = neighborsOf(collection, from).next
  await rowControls(page, collection, from).next.click()
  await waitForRest(page, target)
  return target
}

// Every product's retention, read on the harness: the heap with the
// product presented less the heap once its leave has landed. A negative
// reading, or one under the product's geometry bytes, is a reading that
// missed the release, and fails by name.
async function retentionOfProducts(
  page: Page,
  backendPath: string,
  readHeap: () => Promise<number>,
): Promise<Readonly<Record<string, Retention>>> {
  const byProduct: Record<string, Retention> = {}
  for (const product of products) {
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForStageWarm(page)
    await waitForProductReady(page)
    const geometry = (await page.evaluate(() => window.__viewer?.model?.geometryBytes)) ?? null
    if (geometry === null) {
      throw new Error(`the stage reports no geometry bytes for the presented ${product.slug}`)
    }
    const withProduct = await readHeap()
    await leaveProduct(page)
    const retained = withProduct - (await readHeap())
    if (retained < 0) {
      throw new Error(
        `the heap grew by ${-retained} bytes when the ${product.slug} left: the reading cannot see its release`,
      )
    }
    expect(
      retained,
      `the heap the ${product.slug} freed when it left, against its ${geometry} geometry bytes`,
    ).toBeGreaterThanOrEqual(geometry)
    byProduct[product.slug] = { geometry, retained }
  }
  return byProduct
}

function smallestGeometry(retention: Readonly<Record<string, Retention>>): number {
  return Math.min(...Object.values(retention).map(({ geometry }) => geometry))
}

test('swapping through the collection again and again leaves GPU memory and the JS heap where a warm-up left them', async ({
  page,
  backendPath,
  expectedBrowserName,
}) => {
  const swaps = (1 + MEASURED_CYCLES + proofCycles) * products.length
  test.setTimeout(testBudgetMs({ productLoads: swaps + 2 * products.length + 1 }))
  const modelReads = trackModelReads(page)
  const readHeap = await heapReaderOf(page, expectedBrowserName)

  // A reading at rest on the first product: its reads ahead are the ones
  // every reading holds, landed, and the GPU counters have settled.
  const readAtRest = async (): Promise<Reading> => {
    const neighbors = neighborsOf(collection, start)
    const ahead = [...new Set([neighbors.previous, neighbors.next])]
      .filter((neighbor) => neighbor.slug !== start.slug)
      .map(modelUrlOf)
      .sort()
    await expect
      .poll(async () => [...((await stageLoads(page))?.bytes ?? [])].sort(), {
        timeout: testBodyBudgetMs,
      })
      .toEqual(ahead)
    await expect.poll(modelReads, { timeout: testBodyBudgetMs }).toBe(0)
    const gpu = await waitForSettledMemory(page)
    return { gpu, heap: readHeap === null ? null : await readHeap() }
  }

  // The retention of every product, measured before the walk on the
  // harness page: the walk itself never holds no product, so its readings
  // cannot bracket one product's release. The measurement navigates the
  // page itself; the walk starts from its own visit of the first product.
  const retention =
    readHeap === null ? null : await retentionOfProducts(page, backendPath, readHeap)

  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)

  await walkCycles(page, 1)
  const measured: Reading[] = []
  for (let cycle = 0; cycle < MEASURED_CYCLES; cycle++) {
    await walkCycles(page, 1)
    measured.push(await readAtRest())
  }
  await walkCycles(page, proofCycles)
  const proof = await readAtRest()

  const [first, second] = measured
  if (first === undefined || second === undefined) {
    throw new Error('the measured cycles took no readings')
  }
  test.info().annotations.push({
    type: 'memory',
    description: JSON.stringify({
      measured,
      proof,
      proofSwaps: proofCycles * products.length,
      retention,
    }),
  })

  expect(second.gpu, 'GPU memory over a measured cycle').toEqual(first.gpu)
  expect(proof.gpu, 'GPU memory after the proof swaps').toEqual(second.gpu)
  if (first.heap !== null && second.heap !== null && proof.heap !== null && retention !== null) {
    const bound = Math.max(first.heap, second.heap) + Math.floor(smallestGeometry(retention) / 2)
    expect(proof.heap, `JS heap after the proof swaps, bound ${bound}`).toBeLessThanOrEqual(bound)
  }
})

async function walkCycles(page: Page, cycles: number): Promise<void> {
  let shown = start
  for (let swap = 0; swap < cycles * products.length; swap++) {
    shown = await swapToNext(page, shown)
  }
  expect(shown.slug).toBe(start.slug)
}
