import { issuesFromZod, parseWithMessages } from '../validation'
import { ManifestError } from './errors'
import { SLUG_PATTERN } from './rules'
import { productManifestSchema, type Product } from './schema'

// Validates one manifest at the boundary. Returns the parsed Product, or
// throws a ManifestError that names the product and every failing field.
export function parseProduct(raw: unknown, source: string): Product {
  const result = parseWithMessages(productManifestSchema, raw)
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
