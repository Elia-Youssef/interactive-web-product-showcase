import type { Page } from '@playwright/test'
import { expect, test, type ConsoleGate } from './fixtures'
import { composeTestModule } from './composeTestModule'
import { productLoadBudgetMs } from './budgets'
import { StageRetiredError } from '../../src/viewer/StageRetiredError'

export async function observeEnvironmentSettleFailures(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__environmentSettleFailures = []
  })
  await composeTestModule(page, {
    path: '/src/viewer/StageEnvironment.tsx',
    name: 'StageEnvironment',
    fixture: '/tests/fixtures/environmentFailures.fixtures.tsx',
    compose: 'renderWithEnvironmentFailures',
    args: [],
  })
}

async function environmentRetirements(page: Page) {
  const failures = await page.evaluate(() => window.__environmentSettleFailures)
  if (failures === undefined) {
    throw new Error('the environment failure recorder was not installed')
  }
  const retired = new StageRetiredError('retired')
  expect(failures).toEqual(
    failures.map(() => ({ name: retired.name, message: retired.message, reason: retired.reason })),
  )
  return failures
}

export async function expectEnvironmentRetirement(page: Page): Promise<void> {
  await expect
    .poll(() => environmentRetirements(page), { timeout: productLoadBudgetMs })
    .toHaveLength(1)
}

export async function expectProductRetirementReports(
  page: Page,
  consoleGate: ConsoleGate,
): Promise<void> {
  const failures = await environmentRetirements(page)
  test.info().annotations.push({
    type: 'environment retirement reports',
    description: String(failures.length),
  })
  // The failed outcome and both StrictMode leaves are always required.
  // A pending environment adds exactly one log per actual owner report.
  consoleGate.expectError(new RegExp(`^console error: ${new StageRetiredError('retired')}$`), {
    times: 3 + failures.length,
  })
}
