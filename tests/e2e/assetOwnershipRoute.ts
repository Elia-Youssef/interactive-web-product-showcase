import type { Page } from '@playwright/test'

// Preserve every export, substituting only the factory boundary. The
// fixture delegates to the original GLTF and KTX2 implementations.
export async function observeAssetOwnership(page: Page): Promise<() => number> {
  return observeFactory(
    page,
    '/src/viewer/product/gltfModelSources.ts',
    'createGltfModelSources',
    'observeModelSources',
  )
}

export async function observeAssetEnvironment(page: Page): Promise<() => number> {
  return observeFactory(
    page,
    '/src/viewer/stageEnvironmentLoads.ts',
    'createStageEnvironmentLoads',
    'observeEnvironmentLoads',
  )
}

async function observeFactory(page: Page, path: string, name: string, observer: string) {
  let substitutions = 0
  await page.route(`**${path}*`, async (route) => {
    if (new URL(route.request().url()).searchParams.has('originalModule')) {
      await route.continue()
      return
    }
    substitutions += 1
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
        export * from '${path}?originalModule';
        import { ${name} as original } from '${path}?originalModule';
        import { ${observer} } from '/tests/fixtures/assetOwnership.fixtures.ts';
        export function ${name}(...args) {
          return ${observer}(original, ...args);
        }
      `,
    })
  })
  return () => substitutions
}
