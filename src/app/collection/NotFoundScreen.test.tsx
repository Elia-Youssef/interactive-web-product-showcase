import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { siteCopy } from '@lib/copy/site'
import { formatProductPath } from '@lib/routing'
import { NotFoundScreen } from './NotFoundScreen'

test('the screen says the product does not exist and links to the collection', () => {
  const path = formatProductPath('placeholder-speaker')
  const html = renderToString(<NotFoundScreen collectionPath={path} />)

  expect(html).toContain('data-screen="not-found"')
  expect(html).toContain(siteCopy.notFoundHeading)
  expect(html).toContain(siteCopy.notFoundLine)
  expect(html).toContain(`href="${path}"`)
  expect(html).toContain(siteCopy.notFoundLink)
})
