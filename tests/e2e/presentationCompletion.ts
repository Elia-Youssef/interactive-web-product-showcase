import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'
import { completedStage } from './stageSettle'

export async function completedPresentation(page: Page): Promise<number> {
  await completedStage(page)
  await page.waitForFunction(
    () => window.__viewer?.overlay?.scroll.pending === 0 && window.__viewer.overlay.committed,
  )
  return page.evaluate(() => window.__viewer?.renderedFrames ?? -1)
}

export async function revealCompleted(page: Page, target: Locator): Promise<void> {
  await completedPresentation(page)
  await target.evaluate((element) => {
    const overlay = window.__viewer?.overlay
    if (!(element instanceof HTMLElement) || overlay === null || overlay === undefined) {
      throw new Error('revealing an action target requires its stage overlay')
    }
    overlay.reveal(element)
  })
  await completedPresentation(page)
}

// Fill may focus and scroll its target too. Finish the previous reveal and
// expose the input before its value changes the card's host or scene.
export async function fillCompleted(page: Page, target: Locator, value: string): Promise<void> {
  await revealCompleted(page, target)
  const before = await actionFacts(target)
  await recordAction(target, ['input'])
  await target.fill(value)
  await assertCompletedAction(page, before, ['input'])
  await completedPresentation(page)
}

// Hold selected host, committed geometry and target actionability through
// the native scroll transaction and both pointer events of the click.
export async function clickCompleted(page: Page, target: Locator): Promise<void> {
  await revealCompleted(page, target)
  const before = await actionFacts(target)
  await target.click({ trial: true })
  const actionable = await actionFacts(target)
  expect(actionable, 'DOM commit, target bounds and scroll hold through actionability').toEqual(
    before,
  )
  expect(actionable.pending).toBe(0)
  expect(actionable.hit, 'the intended target receives the click').toBe(true)
  await recordAction(target)
  await target.click()
  await assertCompletedAction(page, before, ['pointerdown', 'pointerup'])
}

async function assertCompletedAction(
  page: Page,
  before: Awaited<ReturnType<typeof actionFacts>>,
  names: readonly string[],
): Promise<void> {
  const events = await page.evaluate(() =>
    (document.documentElement.dataset.presentationAction ?? '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(
        (line) =>
          JSON.parse(line) as {
            type: string
            pending: number
            hit: boolean
            bounds: unknown
            card: unknown
            completion: { idle: boolean; requestedSequence: number }
          },
      ),
  )
  expect(events.map((event) => event.type)).toEqual(names)
  for (const event of events) {
    expect(event.bounds, 'the actionable target holds through the action events').toEqual(
      before.bounds,
    )
    expect(event.card, 'the committed card host holds through the action events').toEqual(
      before.card,
    )
    expect(event.completion.requestedSequence).toBe(before.requested)
    expect(event.completion.idle).toBe(true)
  }
  expect(
    events.every((event) => event.pending === 0 && event.hit),
    'completion holds through the action',
  ).toBe(true)
}

async function actionFacts(target: Locator) {
  return target.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    const overlay = window.__viewer?.overlay
    return {
      bounds: box.toJSON(),
      hit: hit !== null && element.contains(hit),
      pending: overlay?.scroll.pending,
      scrollers: overlay?.scroll.scrollers,
      card: overlay?.card,
      requested: window.__viewer?.completion?.requestedSequence,
    }
  })
}

async function recordAction(
  target: Locator,
  names: readonly string[] = ['pointerdown', 'pointerup'],
): Promise<void> {
  await target.evaluate((element, names) => {
    const root = element.ownerDocument.documentElement
    root.dataset.presentationAction = ''
    const record = (event: Event) => {
      const overlay = window.__viewer?.overlay
      root.dataset.presentationAction +=
        JSON.stringify({
          type: event.type,
          pending: overlay?.scroll.pending,
          card: overlay?.card,
          completion: window.__viewer?.completion,
          bounds: element.getBoundingClientRect().toJSON(),
          hit: element.contains(event.target instanceof Node ? event.target : null),
        }) + '\n'
    }
    for (const name of names) element.addEventListener(name, record, { once: true, capture: true })
  }, names)
}
