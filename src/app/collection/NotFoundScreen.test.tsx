import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { siteCopy } from '@lib/copy/site'
import { formatProductPath } from '@lib/routing'
import { NotFoundScreen } from './NotFoundScreen'
import { BrowserRouter, RouterProvider } from '../routing'
import { browserWindow } from '../routing/browserWindow.fixtures'

test('the screen says the product does not exist and links to the collection', () => {
  const path = formatProductPath('placeholder-speaker')
  const router = new BrowserRouter(browserWindow('https://app.invalid/'))
  const html = renderToString(
    <RouterProvider router={router}>
      <NotFoundScreen collectionPath={path} />
    </RouterProvider>,
  )

  expect(html).toContain('data-screen="not-found"')
  expect(html).toContain(siteCopy.notFoundHeading)
  expect(html).toContain(siteCopy.notFoundLine)
  expect(html).toContain(`href="${path}"`)
  expect(html).toContain(siteCopy.notFoundLink)
})
