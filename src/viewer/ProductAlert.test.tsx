import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { productFailureFixtures } from './product/failureMessage.fixtures'
import { productFailureDisplay } from './product/failureMessage'
import { ProductAlert } from './ProductAlert'

// Render the actual product boundary, so losing either list semantics or
// the problem prop fails the same contract for every failure kind.
describe('the product failure alert', () => {
  it.each(Object.values(productFailureFixtures))(
    'renders the reason and the semantic problem structure of $kind',
    (failure) => {
      const slug = 'sample-one'
      const display = productFailureDisplay(failure)
      const html = renderToStaticMarkup(<ProductAlert status={{ kind: 'failed', slug, failure }} />)
      const text = (value: string) => renderToStaticMarkup(<>{value}</>)

      const root = html.match(/^<div[^>]*>/)?.[0]
      expect(root).toMatch(/\srole="alert"(?:\s|>)/)
      expect(root).toMatch(/\sdata-testid="product-alert"(?:\s|>)/)
      expect(html.match(/<p[^>]*>(.*?)<\/p>/s)?.[1]).toBe(text(`${slug}: ${display.reason}`))
      const lists = [...html.matchAll(/<ul[^>]*>(.*?)<\/ul>/gs)]
      const items = [...(lists[0]?.[1] ?? '').matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map(
        (item) => item[1],
      )
      expect([...html.matchAll(/<li[^>]*>/g)]).toHaveLength(items.length)
      if ('problems' in failure) {
        expect(lists).toHaveLength(1)
        expect(lists[0]?.[1]?.replace(/<li[^>]*>.*?<\/li>/gs, '')).toBe('')
        expect(items).toHaveLength(failure.problems.length)
        expect(items).toEqual(display.problems?.map(text))
        expect(lists[0]?.[1]).not.toContain(text(`${slug}: ${display.reason}`))
      } else {
        expect(lists).toHaveLength(0)
        expect(items).toHaveLength(0)
        expect(display.problems).toBeUndefined()
      }
    },
  )
})
