import type { ScrollCompletion, ScrollPlan, ScrollPosition } from '@lib/scroll/ScrollCompletion'
import { scrollTarget } from '@lib/scroll/scrollTarget'

type TargetBox = { left: number; top: number; right: number; bottom: number }

// Plan all scrollports before starting any of them. Outer geometry includes
// the inner port's planned movement, so nested ports keep the same target.
export function scrollIntoView(
  element: HTMLElement,
  completion: ScrollCompletion,
  align: 'start' | 'nearest' = 'start',
): () => void {
  return completion.start(plansOf(element, align))
}

function plansOf(element: HTMLElement, align: 'start' | 'nearest'): ScrollPlan[] {
  const plans: ScrollPlan[] = []
  const box = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const target = {
    top: box.top - pixels(style.scrollMarginTop),
    bottom: box.bottom + pixels(style.scrollMarginBottom),
    left: box.left - pixels(style.scrollMarginLeft),
    right: box.right + pixels(style.scrollMarginRight),
  }
  for (let port = element.parentElement; port !== null; port = port.parentElement) {
    const plan = planOf(port, element.ownerDocument, target, align)
    if (plan === null) continue
    plans.push(plan)
    const delta = {
      top: plan.target.top - port.scrollTop,
      left: plan.target.left - port.scrollLeft,
    }
    target.top -= delta.top
    target.bottom -= delta.top
    target.left -= delta.left
    target.right -= delta.left
  }
  return plans
}

function planOf(
  port: HTMLElement,
  document: Document,
  box: TargetBox,
  align: 'start' | 'nearest',
): ScrollPlan | null {
  const css = getComputedStyle(port)
  const documentPort = port === document.scrollingElement
  const x = documentPort || /^(auto|scroll|hidden)$/.test(css.overflowX)
  const y = documentPort || /^(auto|scroll|hidden)$/.test(css.overflowY)
  if (!x && !y) return null
  const bounds = port.getBoundingClientRect()
  const padding = {
    left: pixels(css.scrollPaddingLeft),
    top: pixels(css.scrollPaddingTop),
    right: pixels(css.scrollPaddingRight),
    bottom: pixels(css.scrollPaddingBottom),
  }
  const view = {
    left: (documentPort ? 0 : bounds.left + port.clientLeft) + padding.left,
    top: (documentPort ? 0 : bounds.top + port.clientTop) + padding.top,
  }
  const target = targetsOf(port, box, view, padding, x, y, align)
  return nativePlan(
    port,
    documentPort ? document : port,
    target,
    documentPort ? 'document' : port.tagName,
  )
}

function targetsOf(
  port: HTMLElement,
  box: TargetBox,
  view: ScrollPosition,
  padding: TargetBox,
  x: boolean,
  y: boolean,
  align: 'start' | 'nearest',
): ScrollPosition {
  return {
    left: x
      ? scrollTarget(
          {
            position: port.scrollLeft,
            maximum: port.scrollWidth - port.clientWidth,
            start: box.left,
            end: box.right,
            viewStart: view.left,
            viewEnd: view.left + port.clientWidth - padding.left - padding.right,
          },
          'nearest',
        )
      : port.scrollLeft,
    top: y
      ? scrollTarget(
          {
            position: port.scrollTop,
            maximum: port.scrollHeight - port.clientHeight,
            start: box.top,
            end: box.bottom,
            viewStart: view.top,
            viewEnd: view.top + port.clientHeight - padding.top - padding.bottom,
          },
          align,
        )
      : port.scrollTop,
  }
}

function nativePlan(
  port: HTMLElement,
  endTarget: EventTarget,
  target: ScrollPosition,
  name: string,
): ScrollPlan {
  return {
    name,
    target,
    position: () => ({ left: port.scrollLeft, top: port.scrollTop }),
    listenEnd: (end) => {
      endTarget.addEventListener('scrollend', end)
      return () => endTarget.removeEventListener('scrollend', end)
    },
    start: () => port.scrollTo({ ...target, behavior: 'auto' }),
    cancel: () =>
      port.scrollTo({ left: port.scrollLeft, top: port.scrollTop, behavior: 'instant' }),
  }
}

function pixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? 0 : parsed
}
