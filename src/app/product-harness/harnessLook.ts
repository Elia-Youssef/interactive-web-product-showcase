import { issuesFromZod } from '@lib/validation'
import { productLookSchema, type ProductLookBlock } from '@lib/product'

// What the look query parameter parses into: absent means the manifest's own
// look block stands, a valid block overrides it, and an invalid parameter is
// a named reason for the harness alert, never a guess.
export type HarnessLook =
  | { readonly kind: 'none' }
  | { readonly kind: 'override'; readonly look: ProductLookBlock }
  | { readonly kind: 'invalid'; readonly reason: string }

// The dev-only look query parameter of the product harness, as a pure parse.
// The parameter is JSON text, validated by the manifest schema's own look
// block, so e2e drives the same validation the manifests go through and
// proves non-default look values end to end without a second code path.
export function harnessLook(query: string): HarnessLook {
  const value = new URLSearchParams(query).get('look')
  if (value === null || value === '') {
    return { kind: 'none' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(value)
  } catch {
    return { kind: 'invalid', reason: `the look parameter is not JSON: ${value}` }
  }
  const result = productLookSchema.safeParse(raw)
  if (result.success) {
    return { kind: 'override', look: result.data }
  }
  const issues = issuesFromZod(result.error.issues)
  return {
    kind: 'invalid',
    reason: `the look parameter is not a valid look block: ${issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ')}`,
  }
}
