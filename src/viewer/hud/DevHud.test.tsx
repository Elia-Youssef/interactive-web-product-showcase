import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AppStoreProvider } from '@store/index'
import { FrameClock } from '../FrameClock'
import { DevHud } from './DevHud'
import { hudRestText } from './restText'

// The rest text the settle helpers wait for is the text the HUD renders: a
// fresh clock holds no frame, which is the drained window the rest text
// describes, and the static render must spell the one export, not a second
// copy of it.
test('the dev HUD renders the rest text the automation reads', () => {
  const html = renderToString(
    <AppStoreProvider>
      <DevHud clock={new FrameClock()} />
    </AppStoreProvider>,
  )

  expect(html).toContain(`data-testid="hud-fps">${hudRestText.fps}<`)
  expect(html).toContain(`data-testid="hud-tick-cpu">${hudRestText.tickMs}<`)
})
