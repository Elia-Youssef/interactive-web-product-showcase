import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Disclosure } from './Disclosure'

function render(expanded: boolean, headingLevel?: 2 | 3): string {
  return renderToString(
    <Disclosure
      label="Section, 2"
      expanded={expanded}
      onToggle={() => {}}
      {...(headingLevel === undefined ? {} : { headingLevel })}
    >
      <p>Inside the section</p>
    </Disclosure>,
  )
}

describe('Disclosure', () => {
  it('renders closed as its heading button alone: collapsed, controlling nothing', () => {
    const html = render(false)
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('aria-controls')
    expect(html).not.toContain('Inside the section')
    expect(html).toContain('>Section, 2<')
  })

  it('renders open with its content, which the button names as what it controls', () => {
    const html = render(true)
    expect(html).toContain('aria-expanded="true"')
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1]
    expect(controls).toBeDefined()
    expect(html).toContain(`<div id="${controls}"><p>Inside the section</p>`)
  })

  it('puts the button inside the heading level its caller names, h2 by default', () => {
    expect(render(false)).toMatch(/<h2[^>]*><button/)
    expect(render(false, 3)).toMatch(/<h3[^>]*><button/)
  })
})
