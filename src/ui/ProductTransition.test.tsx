import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { siteCopy } from '@lib/copy/site'
import type { ProductTransitionPhase } from '@lib/transition'
import { ProductTransition } from './ProductTransition'

const noOp = () => {}

function render(phase: ProductTransitionPhase, reducedMotion = false) {
  return renderToString(
    <ProductTransition
      phase={phase}
      reducedMotion={reducedMotion}
      onCovered={noOp}
      onRevealed={noOp}
    />,
  )
}

test('ProductTransition draws nothing while idle', () => {
  expect(render('idle')).toBe('')
})

test('ProductTransition draws the band with the collection words while covering', () => {
  const html = render('covering')

  expect(html).toContain(siteCopy.studioName)
  expect(html).toContain(siteCopy.collectionName)
})

test('ProductTransition repeats the collection words through the band', () => {
  const html = render('covering')

  const words = html.split(siteCopy.studioName).length - 1
  expect(words).toBeGreaterThan(2)
  expect(html.split(siteCopy.collectionName).length - 1).toBe(words)
})

test('ProductTransition holds the band through covered and moves it out while revealing', () => {
  expect(render('covered')).toContain(siteCopy.studioName)
  expect(render('revealing')).toContain(siteCopy.studioName)
})

test('ProductTransition hides from assistive tech and holds nothing focusable', () => {
  for (const phase of ['covering', 'covered', 'revealing'] as const) {
    const html = render(phase)

    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toMatch(/<button|<a |<input|tabindex/)
  }
})

test('ProductTransition crossfades under reduced motion, with no ticker text', () => {
  const html = render('covering', true)

  expect(html).not.toBe('')
  expect(html).not.toContain(siteCopy.studioName)
  expect(html).not.toContain(siteCopy.collectionName)
})
