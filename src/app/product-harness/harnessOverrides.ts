import type { z } from 'zod/mini'
import { issuesFromZod, parseWithMessages } from '@lib/validation'
import {
  productCameraSchema,
  productLookSchema,
  type Product as ProductManifest,
  type ProductCameraBlock,
  type ProductLookBlock,
} from '@lib/product'

// The manifest blocks the dev-only harness lets a query parameter override,
// each by the parameter of the block's own name: the look, and the camera
// block, whose distance limits drive the camera contract end to end. Every
// parameter is JSON text validated by the manifest schema's own block, so
// e2e drives the same validation the manifests go through, and a product
// whose override breaks a rule fails exactly like a shipped manifest would.
export type HarnessOverrides = {
  readonly look?: ProductLookBlock
  readonly camera?: ProductCameraBlock
}

// What the query parses into: the blocks it overrides, possibly none, or a
// named reason for the harness alert, never a guess.
export type HarnessOverrideParse =
  | { readonly kind: 'valid'; readonly overrides: HarnessOverrides }
  | { readonly kind: 'invalid'; readonly reason: string }

type BlockParse<Block> =
  | { readonly kind: 'none' }
  | { readonly kind: 'override'; readonly block: Block }
  | { readonly kind: 'invalid'; readonly reason: string }

// The override parameters of the harness, as a pure parse. The first
// invalid parameter names the problem; an absent or empty parameter leaves
// the manifest's own block standing.
export function harnessOverrides(query: string): HarnessOverrideParse {
  const params = new URLSearchParams(query)
  const look = parseBlock(params, 'look', productLookSchema)
  const camera = parseBlock(params, 'camera', productCameraSchema)
  for (const block of [look, camera]) {
    if (block.kind === 'invalid') {
      return { kind: 'invalid', reason: block.reason }
    }
  }
  return {
    kind: 'valid',
    overrides: {
      ...(look.kind === 'override' ? { look: look.block } : {}),
      ...(camera.kind === 'override' ? { camera: camera.block } : {}),
    },
  }
}

function parseBlock<Schema extends z.ZodMiniType>(
  params: URLSearchParams,
  name: string,
  schema: Schema,
): BlockParse<z.output<Schema>> {
  const value = params.get(name)
  if (value === null || value === '') {
    return { kind: 'none' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(value)
  } catch {
    return { kind: 'invalid', reason: `the ${name} parameter is not JSON: ${value}` }
  }
  const result = parseWithMessages(schema, raw)
  if (result.success) {
    return { kind: 'override', block: result.data }
  }
  const issues = issuesFromZod(result.error.issues)
  return {
    kind: 'invalid',
    reason: `the ${name} parameter is not a valid ${name} block: ${issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ')}`,
  }
}

// The manifest the page hands the product: the collection's own, with the
// overridden blocks riding on it, so the product path reads one source per
// block, its manifest. Undefined stays undefined, for the page's no-slug
// state.
export function withOverrides(
  manifest: ProductManifest | undefined,
  overrides: HarnessOverrides,
): ProductManifest | undefined {
  if (manifest === undefined) {
    return undefined
  }
  return { ...manifest, ...overrides }
}
