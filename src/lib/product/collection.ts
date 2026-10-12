import { CollectionError, type CollectionProblem, ManifestError } from './errors'
import { parseProduct } from './parse'
import type { Product } from './schema'

export type ProductNeighbors = {
  readonly previous: Product
  readonly next: Product
}

export type ProductCollection = {
  // Ordered by number ascending; the order of the input never matters.
  readonly products: readonly Product[]
  // The first product, for the '/' redirect.
  readonly first: Product
  bySlug(slug: string): Product | undefined
  // Wraps around at both ends; a one-product collection is its own neighbor.
  neighbors(slug: string): ProductNeighbors | undefined
}

type ParsedManifest = {
  readonly source: string
  readonly product: Product
}

const EMPTY_COLLECTION_MESSAGE = 'a collection needs at least one product'

// Builds the collection from raw manifests. Validates every manifest, then the
// cross-product rules, and reports every problem in one CollectionError.
export function createCollection(rawManifests: readonly unknown[]): ProductCollection {
  const { parsed, problems } = parseAll(rawManifests)
  problems.push(...crossProductProblems(parsed))
  if (problems.length > 0) {
    throw new CollectionError(problems)
  }
  return assemble(parsed)
}

function parseAll(rawManifests: readonly unknown[]): {
  parsed: ParsedManifest[]
  problems: CollectionProblem[]
} {
  const parsed: ParsedManifest[] = []
  const problems: CollectionProblem[] = []
  rawManifests.forEach((raw, index) => {
    const source = `manifests[${index}]`
    try {
      parsed.push({ source, product: parseProduct(raw, source) })
    } catch (error) {
      if (!(error instanceof ManifestError)) {
        throw error
      }
      for (const issue of error.issues) {
        problems.push({ product: error.label, path: issue.path, message: issue.message })
      }
    }
  })
  return { parsed, problems }
}

function crossProductProblems(parsed: readonly ParsedManifest[]): CollectionProblem[] {
  if (parsed.length === 0) {
    return [{ product: null, path: null, message: EMPTY_COLLECTION_MESSAGE }]
  }
  const duplicateSlugs = duplicateProblems(
    parsed,
    'slug',
    (entry) => entry.product.slug,
    (slug) => `duplicate slug '${slug}'`,
  )
  const duplicateNumbers = duplicateProblems(
    parsed,
    'number',
    (entry) => String(entry.product.number),
    (number) => `duplicate product number ${number}`,
  )
  return [
    ...duplicateSlugs,
    ...duplicateNumbers,
    // The sequence rule only means anything for distinct numbers: a
    // duplicate is its own finding, and a sequence report after one would
    // just repeat that duplicate as a consequence.
    ...(duplicateNumbers.length === 0 ? contiguityProblems(parsed) : []),
  ]
}

// The numbers are the positions: they run 1 to N with no gap, so a
// product's number is its place in the collection and the counter is
// number / count. Reports every product whose number is not its position,
// naming the position's number and the number the product carries.
function contiguityProblems(parsed: readonly ParsedManifest[]): CollectionProblem[] {
  const sorted = [...parsed].sort((left, right) => byNumberAscending(left.product, right.product))
  const problems: CollectionProblem[] = []
  sorted.forEach((entry, index) => {
    const expected = index + 1
    if (entry.product.number !== expected) {
      problems.push({
        product: entry.source,
        path: 'number',
        message: `expected product number ${expected}, found ${entry.product.number}`,
      })
    }
  })
  return problems
}

// Reports every later occurrence of a value that was already used by an
// earlier manifest, so all duplicates surface in one pass.
function duplicateProblems(
  parsed: readonly ParsedManifest[],
  field: string,
  valueOf: (entry: ParsedManifest) => string,
  describe: (value: string) => string,
): CollectionProblem[] {
  const firstSourceByValue = new Map<string, string>()
  const problems: CollectionProblem[] = []
  for (const entry of parsed) {
    const value = valueOf(entry)
    if (firstSourceByValue.has(value)) {
      problems.push({ product: entry.source, path: field, message: describe(value) })
      continue
    }
    firstSourceByValue.set(value, entry.source)
  }
  return problems
}

function byNumberAscending(left: Product, right: Product): number {
  return left.number - right.number
}

function assemble(parsed: readonly ParsedManifest[]): ProductCollection {
  const products = parsed.map((entry) => entry.product).sort(byNumberAscending)
  const count = products.length
  // The collection checks above guarantee at least one product; the type
  // cannot know, so the guard stays.
  const first = products[0]
  if (first === undefined) {
    throw new CollectionError([{ product: null, path: null, message: EMPTY_COLLECTION_MESSAGE }])
  }
  const indexOfSlug = new Map<string, number>(
    products.map((product, index) => [product.slug, index]),
  )
  return {
    products,
    first,
    bySlug: (slug) => {
      const index = indexOfSlug.get(slug)
      return index === undefined ? undefined : productAt(products, index)
    },
    neighbors: (slug) => {
      const index = indexOfSlug.get(slug)
      if (index === undefined) {
        return undefined
      }
      return {
        previous: productAt(products, index === 0 ? count - 1 : index - 1),
        next: productAt(products, (index + 1) % count),
      }
    },
  }
}

// The wrap-around arithmetic always lands inside the list; the guard keeps
// the helper total.
function productAt(products: readonly Product[], index: number): Product {
  const product = products[index]
  if (product === undefined) {
    throw new Error(`internal error: no product at index ${index}`)
  }
  return product
}
