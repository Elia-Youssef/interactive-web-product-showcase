import { NeutralToneMapping } from 'three'
import { backendLabels } from '../../src/lib/renderer/backendLabels'
import { expect, test } from './fixtures'

test('the shell mounts its main landmark inside #root', async ({ page, backendPath }) => {
  await page.goto(backendPath)
  await expect(page.locator('#root').getByRole('main')).toBeAttached()
})

test('the stage reaches ready on the expected backend with neutral tone mapping', async ({
  page,
  backendPath,
  expectedBackend,
}) => {
  await page.goto(backendPath)

  // The automation hook is the contract: assert it directly, never the DOM.
  // Ready implies the stage's start-up checks passed, among them the
  // one-three-instance check on the live scene and renderer, so this
  // assertion is the one-instance proof of the running app in every build.
  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('ready')
  await expect.poll(() => page.evaluate(() => window.__viewer?.backend)).toBe(expectedBackend)
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.toneMapping))
    .toBe(NeutralToneMapping)

  // The HUD shows the same backend the hook reports, in its readable label.
  const hud = page.getByTestId('dev-hud')
  await expect(hud).toHaveAttribute('data-backend', expectedBackend)
  await expect(hud).toContainText(backendLabels[expectedBackend])
})
