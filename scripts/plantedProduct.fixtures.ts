// A planted shipped product on a temporary root: the fixture document
// written as an optimized model under public/models/<slug>, and the rule
// fixtures' manifest under src/products, so the validate step reads it the
// way it reads a real product, through its own discovery and loaders.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Document } from '@gltf-transform/core'
import { ruleFixtureManifestInputOf } from './contractRuleFixtures.ts'
import { writeOptimizedModel, type OptimizeOverrides } from './optimizedModel.fixtures.ts'
import { MANIFEST_SUFFIX, productPaths } from './productPaths.ts'

export async function plantProduct(
  root: string,
  slug: string,
  doc: Document,
  overrides: OptimizeOverrides = {},
): Promise<void> {
  const paths = productPaths(root, slug)
  await mkdir(path.dirname(paths.modelGlb), { recursive: true })
  await mkdir(path.join(root, 'src', 'products'), { recursive: true })
  await writeOptimizedModel(doc, paths.modelGlb, overrides)
  await writeFile(
    path.join(root, 'src', 'products', `${slug}${MANIFEST_SUFFIX}`),
    `export const manifest = ${JSON.stringify(ruleFixtureManifestInputOf(slug), null, 2)}\n`,
    'utf8',
  )
}
