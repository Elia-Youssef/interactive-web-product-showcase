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
      <ExplodeToggleButton label="See inside" view={view} disabled={false} onPress={() => {}} />,
    )

    expect(html).toContain(`aria-pressed="${pressed}"`)
  },
)
