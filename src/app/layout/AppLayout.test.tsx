import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { siteCopy } from '@lib/copy/site'
import { AppLayout } from './AppLayout'

test('AppLayout renders banner, main, complementary, and region landmarks', () => {
  const html = renderToString(<AppLayout />)

  expect(html).toContain('<header')
  expect(html).toContain('<main')
  expect(html).toContain('<aside')
  expect(html).toContain('<section')
  expect(html).toContain(`aria-label="${siteCopy.panelLabel}"`)
  expect(html).toContain(`aria-label="${siteCopy.stageLabel}"`)
})

test('AppLayout renders site copy for studio, collection, stage, and site URL', () => {
  const html = renderToString(<AppLayout />)

  expect(html).toContain(siteCopy.studioName)
  expect(html).toContain(siteCopy.collectionName)
  expect(html).toContain(siteCopy.stageLabel)
  expect(html).toContain(siteCopy.stageHint)
  expect(html).toContain(siteCopy.siteUrl)
  expect(html).toContain(siteCopy.credit)
})

test('AppLayout renders four chrome corners with their data attributes', () => {
  const html = renderToString(<AppLayout />)

  expect(html).toContain('data-corner="top-left"')
  expect(html).toContain('data-corner="top-right"')
  expect(html).toContain('data-corner="bottom-left"')
  expect(html).toContain('data-corner="bottom-right"')
})

test('AppLayout renders decorative bottom sheet handle for phone layout', () => {
  const html = renderToString(<AppLayout />)

  expect(html).toContain('aria-hidden="true"')
})

test('AppLayout renders content in provided slots', () => {
  const html = renderToString(
    <AppLayout
      mark={<span data-testid="test-mark">M</span>}
      productIndex={<span data-testid="test-index">01 / AUDIO</span>}
      panel={<p data-testid="test-panel">Product story</p>}
      stage={<canvas data-testid="test-canvas" />}
      angleReadout={<span data-testid="test-readout">127 / 360</span>}
      stageControls={<button data-testid="test-controls">Reset</button>}
    />,
  )

  expect(html).toContain('data-testid="test-mark"')
  expect(html).toContain('data-testid="test-index"')
  expect(html).toContain('data-testid="test-panel"')
  expect(html).toContain('data-testid="test-canvas"')
  expect(html).toContain('data-testid="test-readout"')
  expect(html).toContain('data-testid="test-controls"')
})
