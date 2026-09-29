import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Divider } from './Divider'

test('Divider renders a single rule', () => {
  const html = renderToString(<Divider />)

  expect(html).toMatch(/^<hr/)
  expect(html).not.toContain('</hr>')
})
