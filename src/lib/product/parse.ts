import { z } from 'zod'
import { formatFieldPath, ManifestError, type ProductIssue } from './errors'
import { SLUG_PATTERN } from './rules'
import { productManifestSchema, type Product } from './schema'

const UNKNOWN_KEY_MESSAGE = 'unknown key'

// Validates one manifest at the boundary. Returns the parsed Product, or
// throws a ManifestError that names the product and every failing field.
export function parseProduct(raw: unknown, source: string): Product {
  const result = productManifestSchema.safeParse(raw)
  if (result.success) {
    return result.data
  }
  throw new ManifestError(productLabel(raw, source), issuesFromZod(result.error.issues))
}

// The error names the product by slug when the slug itself is valid, so a
// broken field is still attributed to its product; otherwise by its source.
function productLabel(raw: unknown, source: string): string {
  const slug = rawSlug(raw)
  return slug ?? source
}

function rawSlug(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null || !('slug' in raw)) {
    return undefined
  }
  const slug = raw.slug
  return typeof slug === 'string' && SLUG_PATTERN.test(slug) ? slug : undefined
}

// Maps zod issues to the structured (path, message) form the errors carry.
// An unrecognized key reports once per key, with the key appended to the path.
function issuesFromZod(issues: readonly z.core.$ZodIssue[]): ProductIssue[] {
  const productIssues: ProductIssue[] = []
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        productIssues.push({
          path: formatFieldPath([...issue.path, key]),
          message: UNKNOWN_KEY_MESSAGE,
        })
      }
      continue
    }
    productIssues.push({ path: formatFieldPath(issue.path), message: issue.message })
  }
  return productIssues
}
