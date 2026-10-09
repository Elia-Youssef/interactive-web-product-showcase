import type { Page } from '@playwright/test'

type TestComposition = {
  readonly path: string
  readonly name: string
  readonly fixture: string
  readonly compose: string
  readonly args: readonly unknown[]
}

// Vite transforms the fixture and the original module normally. Only the
// importing boundary changes: faults and owner controls remain test code.
export async function composeTestModule(
  page: Page,
  composition: TestComposition,
): Promise<() => number> {
  let substitutions = 0
  await page.route(`**${composition.path}*`, async (route) => {
    if (new URL(route.request().url()).searchParams.has('originalModule')) {
      await route.continue()
      return
    }
    substitutions += 1
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
        import { ${composition.name} as Original } from '${composition.path}?originalModule';
        import { ${composition.compose} as compose } from '${composition.fixture}';
        export function ${composition.name}(props) {
          return compose(Original, props, ...${JSON.stringify(composition.args)});
        }
      `,
    })
  })
  return () => substitutions
}
