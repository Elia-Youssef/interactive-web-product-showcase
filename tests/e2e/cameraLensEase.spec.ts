import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { expect, test } from './fixtures'
import { markerOf } from './hotspotViews'
import { readProductCameraFacts, type AuthoredView } from './productCamera'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { lensBandAtRest } from './stageCamera'
import { settledFrames } from './stageSettle'

// The eased lens of a close-up. A close-up whose authored lens differs from
// the home lens changes the field of view on the way there, and the lens
// eases with the pose: over several presented frames, never in one. Each
// frame's lens comes from the harness's lens recorder, which records the
// effective vertical fov in the stage's post-present phase, one entry per
// presented frame. Opening the hotspot's card moves the lens from the home
// lens toward the close-up lens: the first presented frame after the
// request lies strictly between the two, the series runs monotonically
// toward the close-up lens, and it ends on it. Escape eases it back the
// same way. The subjects come from the product set: every hotspot whose
// close-up lens differs from its product's home lens.

type LensSubject = {
  readonly product: Product
  readonly hotspot: Product['hotspots'][number]
  readonly homeFovY: number
  readonly view: AuthoredView
}

const subjects = await lensSubjects()

for (const { product, hotspot, homeFovY, view } of subjects) {
  test(`camera ${product.slug}: opening ${hotspot.title} eases the lens to its close-up over several presented frames, and Escape eases it back`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)
    await settledFrames(page)

    const atHome = await restingLens(page)
    await startLensRecording(page)
    await markerOf(page, hotspot.title).click()
    await settledFrames(page)
    expectEasedLens(await takeLensRecording(page), {
      rest: atHome,
      from: homeFovY,
      to: view.fovY,
      baseFovY: homeFovY,
      why: 'opening',
    })

    const atCloseUp = await restingLens(page)
    await startLensRecording(page)
    await page.keyboard.press('Escape')
    await settledFrames(page)
    expectEasedLens(await takeLensRecording(page), {
      rest: atCloseUp,
      from: view.fovY,
      to: homeFovY,
      baseFovY: homeFovY,
      why: 'Escape',
    })
  })
}

// Every hotspot of the product set whose close-up lens differs from its
// product's home lens. Fails at collection when the set carries none, so
// the proof never disappears silently with the product it was written for.
async function lensSubjects(): Promise<readonly LensSubject[]> {
  const found: LensSubject[] = []
  for (const product of await harnessProducts()) {
    const facts = await readProductCameraFacts(product.slug)
    for (const hotspot of product.hotspots) {
      const view = facts.closeUps.get(hotspot.id)
      if (view !== undefined && view.fovY !== facts.home.fovY) {
        found.push({ product, hotspot, homeFovY: facts.home.fovY, view })
      }
    }
  }
  if (found.length === 0) {
    throw new Error('the product set carries no close-up with a lens of its own for the lens proof')
  }
  return found
}

function startLensRecording(page: Page): Promise<void> {
  return page.evaluate(() => {
    const recorder = window.__harnessLensFrames
    if (recorder === undefined) {
      throw new Error('the harness lens recorder is not mounted')
    }
    recorder.start()
  })
}

function takeLensRecording(page: Page): Promise<readonly number[]> {
  return page.evaluate(() => {
    const recorder = window.__harnessLensFrames
    if (recorder === undefined) {
      throw new Error('the harness lens recorder is not mounted')
    }
    return [...recorder.take()]
  })
}

// The lens the stage rests on before a request: the live camera's
// effective fov, read at rest, so it is the lens of the last presented
// frame.
async function restingLens(page: Page): Promise<number> {
  const fovY = await page.evaluate(() => window.__viewer?.camera?.fovY ?? null)
  if (fovY === null) {
    throw new Error('the stage camera must answer its lens at rest')
  }
  return fovY
}

// One eased lens move: the lens the stage rested on before the request,
// the authored lens it starts from and the one it ends on, and the base
// lens both ride the zoom channel through.
type LensMove = {
  readonly rest: number
  readonly from: number
  readonly to: number
  readonly baseFovY: number
  readonly why: string
}

// The lens of every frame presented from the request to rest, eased from
// one authored lens to the other. The authored ends are held to the band
// the controls' rest threshold maps to at each end's zoom through the base
// lens: the move starts from a rest within that band of its start lens,
// and it rests within the band of its end lens. The first presented frame
// lies strictly between: it has left the lens the stage rested on, an
// exact comparison, since a frame that has not moved draws the very same
// lens, and it is still outside the end band, which a frame that snapped
// already sits in. From there every frame moves toward the end or holds.
function expectEasedLens(frames: readonly number[], move: LensMove): void {
  const { rest, from, to, baseFovY, why } = move
  const first = frames[0]
  const last = frames[frames.length - 1]
  if (first === undefined || last === undefined) {
    throw new Error(`${why}: the request must present at least one frame`)
  }
  const direction = Math.sign(to - from)
  const toBand = lensBandAtRest(baseFovY, to)

  expect(
    Math.abs(rest - from),
    `${why}: the stage must rest on the start lens ${from} before the request, at ${rest}`,
  ).toBeLessThanOrEqual(lensBandAtRest(baseFovY, from))
  expect(
    direction * (first - rest),
    `${why}: the first presented frame's lens ${first} must have left the resting lens ${rest}`,
  ).toBeGreaterThan(0)
  expect(
    direction * (to - first),
    `${why}: the first presented frame's lens ${first} must not yet be the end lens ${to}`,
  ).toBeGreaterThan(toBand)
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    if (previous === undefined || current === undefined) {
      throw new Error(`${why}: the recording has a gap at frame ${index}`)
    }
    expect(
      direction * (current - previous),
      `${why}: frame ${index} moved the lens from ${previous} to ${current}, against the ease`,
    ).toBeGreaterThanOrEqual(0)
  }

  expect(
    Math.abs(last - to),
    `${why}: the last presented frame's lens ${last} must rest on the end lens ${to}`,
  ).toBeLessThanOrEqual(toBand)
}
