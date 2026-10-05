import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { LinkProps } from './link'
import { ChevronLeftIcon } from './icons'
import { IconLink } from './IconLink'

// The gallery's own stand-in for the app's link: a plain anchor with the
// contract's props, so the static render needs no router.
function FakeLink({ to, children, ...rest }: LinkProps) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  )
}

test('IconLink renders through the link it is handed, named by its label', () => {
  const html = renderToString(
    <IconLink link={FakeLink} to="/p/sample-one" aria-label="Previous: Sample One">
      <ChevronLeftIcon />
    </IconLink>,
  )

  expect(html).toMatch(/^<a\b/)
  expect(html).toContain('href="/p/sample-one"')
  expect(html).toContain('aria-label="Previous: Sample One"')
})

test('IconLink renders its icon child', () => {
  const html = renderToString(
    <IconLink link={FakeLink} to="/p/sample-one" aria-label="Previous">
      <ChevronLeftIcon />
    </IconLink>,
  )

  expect(html).toContain('<svg')
})

test('IconLink forwards the class name and the forced hover state to the link', () => {
  const html = renderToString(
    <IconLink
      link={FakeLink}
      to="/p/sample-one"
      aria-label="Previous"
      className="extra"
      data-force-hover
    >
      <ChevronLeftIcon />
    </IconLink>,
  )

  expect(html).toContain('extra')
  expect(html).toContain('data-force-hover="true"')
})
