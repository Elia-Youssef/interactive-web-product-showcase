import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ExplodeToggleButton } from './ProductExplodeToggle'

// A static render of the button alone reaches every view state, which the
// store-bound toggle cannot: renderToString reads the store's initial state.
test.each([
  { view: 'assembled', pressed: 'false' },
  { view: 'partial', pressed: 'mixed' },
  { view: 'open', pressed: 'true' },
] as const)(
  'the toggle announces aria-pressed="$pressed" for a $view view',
  ({ view, pressed }) => {
    const html = renderToString(
      <ExplodeToggleButton label="See inside" view={view} unavailable={false} onPress={() => {}} />,
    )

    expect(html).toContain(`aria-pressed="${pressed}"`)
  },
)

// The pass-through of the waiting rule: the announced wait on the element,
// and never the native attribute that would drop a held focus. The
// activation the wait ignores is the primitive's own contract, proven on
// TextButton.
test('a waiting toggle announces the wait and keeps the tab order', () => {
  const html = renderToString(
    <ExplodeToggleButton label="See inside" view="assembled" unavailable onPress={() => {}} />,
  )

  expect(html).toContain('aria-disabled="true"')
  expect(html).not.toMatch(/\sdisabled[=\s/>]/)
})
