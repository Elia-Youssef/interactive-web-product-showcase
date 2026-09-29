import { expect, test } from './fixtures'

test('the shell mounts its main landmark inside #root', async ({ page, backendPath }) => {
  await page.goto(backendPath)
  await expect(page.locator('#root').getByRole('main')).toBeAttached()
})
