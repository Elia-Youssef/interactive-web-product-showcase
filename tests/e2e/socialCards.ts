// The page-side contract of the social card captures: the waits a card
// needs before its shot, and the frame rule the shot keeps. It lives in the
// suite because the waits are page contracts written against the browser
// globals, like every other helper here, and because the settle it rides on
// is the suite's own.
import type { Page } from '@playwright/test'
import { productLoadBudgetMs } from './budgets'
import { cutElements, type Box, type FramedElement } from './cardFrame'
import { settledForCapture } from './stageCapture'

// The card size of the social platforms, at one device pixel so the shot is
// the CSS layout. The width clears the desktop breakpoint, so the capture
// carries the full frame: top bar, panel, stage and its chrome.
export const socialCardViewport = { width: 1200, height: 630 } as const

// Waits for the presented product, through the automation hook the app
// installs in every build. A non-null model is a presented product, so the
// slug equality is the proof the card shows the route's own product.
async function waitForPresentedProduct(page: Page, slug: string): Promise<void> {
  await page.waitForFunction((expected) => window.__viewer?.model?.slug === expected, slug, {
    timeout: productLoadBudgetMs,
  })
}

// Marks every element of the page that shows and paints something of its
// own (text, replaced content, a background, a border or a shadow) with a
// probe id, and returns each with its border box.
function markPaintingElements(
  page: Page,
): Promise<{ readonly id: string; readonly name: string; readonly box: Box }[]> {
  return page.evaluate(() => {
    const replaced = new Set(['IMG', 'CANVAS', 'VIDEO', 'svg', 'INPUT', 'SELECT', 'TEXTAREA'])
    const paints = (element: Element) => {
      const style = getComputedStyle(element)
      return (
        replaced.has(element.tagName) ||
        [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
        ) ||
        !/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor) ||
        style.backgroundImage !== 'none' ||
        style.boxShadow !== 'none' ||
        ['top', 'right', 'bottom', 'left'].some(
          (side) => style.getPropertyValue(`border-${side}-width`) !== '0px',
        )
      )
    }
    const shows = (element: Element) => {
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) === 0) {
          return false
        }
      }
      return getComputedStyle(element).visibility === 'visible'
    }
    document.querySelectorAll('[data-card-probe]').forEach((element) => {
      element.removeAttribute('data-card-probe')
    })
    return [...document.body.querySelectorAll('*')]
      .filter((element) => element.getClientRects().length > 0 && shows(element) && paints(element))
      .map((element, index) => {
        element.setAttribute('data-card-probe', String(index))
        const box = element.getBoundingClientRect()
        return {
          id: String(index),
          name: `${element.tagName.toLowerCase()} "${(element.textContent ?? '').trim().slice(0, 40)}"`,
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        }
      })
  })
}

// The region each marked element can show through: the card, cut down by
// the padding box of every ancestor that clips its overflow and holds it.
// An absolutely positioned element escapes the clips of the ancestors
// between it and its containing block, and a fixed one escapes them all.
function clipsOfMarked(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const clips: Record<string, Box> = {}
    for (const element of document.querySelectorAll('[data-card-probe]')) {
      let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
      let position = getComputedStyle(element).position
      for (let node = element.parentElement; node !== null; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (position === 'fixed' || (position === 'absolute' && style.position === 'static')) {
          continue
        }
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
          const box = node.getBoundingClientRect()
          const left = box.left + node.clientLeft
          const top = box.top + node.clientTop
          clip = {
            left: Math.max(clip.left, left),
            top: Math.max(clip.top, top),
            right: Math.min(clip.right, left + node.clientWidth),
            bottom: Math.min(clip.bottom, top + node.clientHeight),
          }
        }
        position = style.position
      }
      clips[element.getAttribute('data-card-probe') ?? ''] = clip
    }
    return clips
  })
}

// Every element the card shows, with the region it can show through.
export async function readFramedElements(page: Page): Promise<FramedElement[]> {
  const marked = await markPaintingElements(page)
  const clips = await clipsOfMarked(page)
  return marked.map((element) => {
    const clip = clips[element.id]
    if (clip === undefined) {
      throw new Error(`the marked element ${element.name} lost its probe`)
    }
    return { ...element, clip }
  })
}

// The frame step of a card: every element the card's edge or a clipping
// box would cut is hidden for the shot, so the card shows each element
// whole or not at all. The rule reads the page's live boxes, so it holds
// whatever the panel and the chrome come to hold. Returns the hidden
// elements by name.
export async function frameSocialCard(page: Page): Promise<readonly string[]> {
  const cut = cutElements(await readFramedElements(page))
  await page.evaluate(
    (ids) => {
      for (const id of ids) {
        const element = document.querySelector(`[data-card-probe="${id}"]`)
        if (element instanceof HTMLElement || element instanceof SVGElement) {
          element.style.visibility = 'hidden'
        }
      }
    },
    cut.map((element) => element.id),
  )
  return cut.map((element) => element.name)
}

// The rest a social card waits for, and its frame: the route's own product
// presented, the suite's settle contract (the frame settle and the drained
// one-time DOM animations), the shipped webfonts in place of a fallback face
// a first paint could still carry, and then the frame step. After it, the
// viewport capture pins the landing frame: the load pose, the first finish,
// assembled, with no element cut by the card's edge. A frame that still
// cuts an element fails loudly here.
export async function settledSocialCard(page: Page, slug: string): Promise<void> {
  await waitForPresentedProduct(page, slug)
  await settledForCapture(page)
  await page.evaluate(() => document.fonts.ready)
  await frameSocialCard(page)
  const stillCut = cutElements(await readFramedElements(page))
  if (stillCut.length > 0) {
    throw new Error(
      `the social card of ${slug} still cuts ${stillCut.map((element) => element.name).join(', ')}`,
    )
  }
}
